import "server-only";

import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isProviderProfileType, CREATOR_PROFILE_TYPES } from "@/lib/provider-types";
import { createLiveKitToken, getLiveKitUrl, isLiveKitConfigured } from "@/lib/livekit";
import { triggerEvent } from "@/lib/pusher-server";
import { liveStreamChannelName, LIVE_GIFT_SENT_EVENT, LIVE_STREAM_ENDED_EVENT } from "@/lib/live-stream-channels";
import { settleGift } from "@/lib/hearts";
import { refundOpenLiveRequests, type LiveRequestOptionInput } from "@/lib/live-requests";
import { createNotificationsBulk } from "@/lib/notifications";
import { getActiveSubscriberIds } from "@/lib/subscription-access";
import { ONLINE_WINDOW_MS } from "@/lib/presence";
import { hasIdentityOnFile } from "@/lib/verification";
import { haversineDistanceKm } from "@/lib/home-feed";
import { affinityTerm } from "@/lib/recommendation-scoring";
import { seededTiebreak } from "@/lib/ranking/slate";

function generateRoomName(): string {
  return `live-${randomBytes(12).toString("hex")}`;
}

function normalizeTimeZone(timeZone?: string): string {
  if (!timeZone || timeZone.length > 100) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone;
  } catch {
    return "UTC";
  }
}

function formatScheduledTime(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: normalizeTimeZone(timeZone),
    timeZoneName: "short",
  }).format(date);
}

const TRANSACTION_RETRIES = 3;

class LiveStreamWriteConflictError extends Error {}

async function runSerializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isWriteConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!isWriteConflict) throw error;
      if (attempt === TRANSACTION_RETRIES - 1) throw new LiveStreamWriteConflictError();
    }
  }

  throw new Error("The live stream transaction could not be completed.");
}

async function notifyLiveAudience(
  providerId: string,
  buildNotification: (subscriberId: string) => {
    recipientId: string;
    actorId?: string;
    type: "live";
    title: string;
    body: string;
    href: string;
  },
): Promise<void> {
  try {
    const subscriberIds = await getActiveSubscriberIds(providerId);
    if (subscriberIds.length > 0) {
      await createNotificationsBulk(subscriberIds.map(buildNotification));
    }
  } catch (error) {
    console.error("Live audience notification failed", { providerId, error });
  }
}

export type StartLiveStreamResult =
  | { ok: true; stream: { id: string; roomName: string; title: string }; token: string; livekitUrl: string }
  | { ok: false; status: number; error: string };

export async function startLiveStream(
  providerId: string,
  title: string,
  options: LiveRequestOptionInput[],
  heartGoal?: number | null,
  notifySubscribers = false,
): Promise<StartLiveStreamResult> {
  if (!isLiveKitConfigured()) {
    return { ok: false, status: 503, error: "Live streaming isn't configured yet." };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: providerId },
    select: { id: true, displayName: true, profileType: true },
  });
  if (!profile || !isProviderProfileType(profile.profileType)) {
    return { ok: false, status: 403, error: "Only creators can host a live stream." };
  }
  if (!(await hasIdentityOnFile(providerId))) {
    return { ok: false, status: 403, error: "Verify your identity before going live." };
  }

  const streamTitle = title.trim().slice(0, 120) || `${profile.displayName}'s live stream`;
  let transition;
  try {
    transition = await runSerializable(async (tx) => {
      const active = await tx.liveStream.findFirst({
        where: { providerId, status: "live" },
        orderBy: { startedAt: "desc" },
        select: { id: true, roomName: true, title: true },
      });
      if (active) {
        await tx.liveStream.updateMany({
          where: { providerId, status: "scheduled" },
          data: { status: "ended", endedAt: new Date() },
        });
        return { stream: active, isBrandNew: false, isStartingScheduled: false };
      }

      await tx.liveStream.updateMany({
        where: { providerId, status: "scheduled", scheduledFor: null },
        data: { status: "ended", endedAt: new Date() },
      });

      // Reuse the scheduled row so every previously shared URL becomes the live room.
      const scheduled = await tx.liveStream.findFirst({
        where: { providerId, status: "scheduled", scheduledFor: { not: null } },
        orderBy: { scheduledFor: "asc" },
        select: { id: true },
      });
      if (scheduled) {
        await tx.liveStream.updateMany({
          where: { providerId, status: "scheduled", id: { not: scheduled.id } },
          data: { status: "ended", endedAt: new Date() },
        });
        const stream = await tx.liveStream.update({
          where: { id: scheduled.id, status: "scheduled" },
          data: {
            status: "live",
            startedAt: new Date(),
            endedAt: null,
            scheduledFor: null,
            title: streamTitle,
            heartGoal: heartGoal && heartGoal > 0 ? Math.min(Math.trunc(heartGoal), 1_000_000) : null,
            requestOptions: {
              deleteMany: {},
              create: options.map((option, sortOrder) => ({ ...option, sortOrder })),
            },
          },
          select: { id: true, roomName: true, title: true },
        });
        return { stream, isBrandNew: false, isStartingScheduled: true };
      }

      const stream = await tx.liveStream.create({
        data: {
          providerId,
          title: streamTitle,
          roomName: generateRoomName(),
          heartGoal: heartGoal && heartGoal > 0 ? Math.min(Math.trunc(heartGoal), 1_000_000) : null,
          requestOptions: {
            create: options.map((option, sortOrder) => ({ ...option, sortOrder })),
          },
        },
        select: { id: true, roomName: true, title: true },
      });
      return { stream, isBrandNew: true, isStartingScheduled: false };
    });
  } catch (error) {
    if (
      error instanceof LiveStreamWriteConflictError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
    ) {
      return { ok: false, status: 409, error: "Your live stream changed in another tab. Refresh and try again." };
    }
    throw error;
  }

  const { stream, isBrandNew, isStartingScheduled } = transition;

  // Only alert subscribers for a stream that's genuinely just starting now, brand new or
  // freshly promoted from scheduled - reconnecting to an already-live session (e.g. a page
  // refresh) hits the plain `existing` branch above and must stay silent.
  if (isStartingScheduled || (isBrandNew && notifySubscribers)) {
    await notifyLiveAudience(providerId, (subscriberId) => ({
      recipientId: subscriberId,
      actorId: providerId,
      type: "live",
      title: `${profile.displayName} is live`,
      body: stream.title,
      href: `/live/${stream.id}`,
    }));
  }

  const token = await createLiveKitToken({
    roomName: stream.roomName,
    identity: providerId,
    name: profile.displayName,
    canPublish: true,
  });

  return { ok: true, stream, token, livekitUrl: getLiveKitUrl() };
}

const MIN_SCHEDULE_LEAD_MINUTES = 10;
const MAX_SCHEDULE_LEAD_DAYS = 30;

export type ScheduleLiveStreamResult =
  | { ok: true; stream: { id: string; roomName: string; title: string; scheduledFor: string } }
  | { ok: false; status: number; error: string };

/** Creates a "scheduled" stream row (its own shareable /live/[id] link) and notifies active
 * subscribers immediately - the "starting soon" reminder fires later, from the cron pass in
 * processScheduledLiveStreams below. */
export async function scheduleLiveStream(
  providerId: string,
  title: string,
  scheduledFor: Date,
  timeZone?: string,
): Promise<ScheduleLiveStreamResult> {
  const profile = await prisma.profile.findUnique({
    where: { id: providerId },
    select: { id: true, displayName: true, profileType: true },
  });
  if (!profile || !isProviderProfileType(profile.profileType)) {
    return { ok: false, status: 403, error: "Only creators can schedule a live stream." };
  }
  if (!(await hasIdentityOnFile(providerId))) {
    return { ok: false, status: 403, error: "Verify your identity before scheduling a live." };
  }

  const scheduledTime = scheduledFor.getTime();
  if (!Number.isFinite(scheduledTime)) {
    return { ok: false, status: 400, error: "Choose a valid date and time." };
  }

  const now = Date.now();
  if (scheduledTime < now + MIN_SCHEDULE_LEAD_MINUTES * 60 * 1000) {
    return { ok: false, status: 400, error: `Schedule at least ${MIN_SCHEDULE_LEAD_MINUTES} minutes from now.` };
  }
  if (scheduledTime > now + MAX_SCHEDULE_LEAD_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, status: 400, error: `Schedule within the next ${MAX_SCHEDULE_LEAD_DAYS} days.` };
  }

  const streamTitle = title.trim().slice(0, 120) || `${profile.displayName}'s live stream`;
  let stream;
  try {
    stream = await runSerializable(async (tx) => {
      await tx.liveStream.updateMany({
        where: { providerId, status: "scheduled", scheduledFor: null },
        data: { status: "ended", endedAt: new Date() },
      });
      const existing = await tx.liveStream.findFirst({
        where: { providerId, status: { in: ["live", "scheduled"] } },
        select: { id: true },
      });
      if (existing) return null;

      return tx.liveStream.create({
        data: {
          providerId,
          title: streamTitle,
          status: "scheduled",
          roomName: generateRoomName(),
          scheduledFor,
        },
        select: { id: true, roomName: true, title: true, scheduledFor: true },
      });
    });
  } catch (error) {
    if (error instanceof LiveStreamWriteConflictError) {
      return { ok: false, status: 409, error: "Another live stream was created at the same time. Refresh and try again." };
    }
    throw error;
  }

  if (!stream) {
    return { ok: false, status: 400, error: "You already have a live stream in progress or scheduled." };
  }

  await notifyLiveAudience(providerId, (subscriberId) => ({
    recipientId: subscriberId,
    actorId: providerId,
    type: "live",
    title: `${profile.displayName} scheduled a live`,
    body: `${streamTitle} - ${formatScheduledTime(scheduledFor, timeZone)}`,
    href: `/live/${stream.id}`,
  }));

  return {
    ok: true,
    stream: { id: stream.id, roomName: stream.roomName, title: stream.title, scheduledFor: stream.scheduledFor!.toISOString() },
  };
}

export async function getScheduledStreamForProvider(providerId: string) {
  const stream = await prisma.liveStream.findFirst({
    where: { providerId, status: "scheduled", scheduledFor: { not: null } },
    orderBy: { scheduledFor: "asc" },
    select: { id: true, title: true, scheduledFor: true },
  });
  if (!stream?.scheduledFor) return null;
  return { ...stream, scheduledFor: stream.scheduledFor };
}

export type CancelScheduledStreamResult = { ok: true } | { ok: false; status: number; error: string };

export async function cancelScheduledLiveStream(providerId: string, streamId: string): Promise<CancelScheduledStreamResult> {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: {
      providerId: true,
      status: true,
      title: true,
      provider: { select: { displayName: true } },
    },
  });
  if (!stream || stream.providerId !== providerId) {
    return { ok: false, status: 404, error: "Scheduled stream not found." };
  }
  if (stream.status !== "scheduled") {
    return { ok: false, status: 400, error: "This stream isn't scheduled." };
  }

  const cancelled = await prisma.liveStream.updateMany({
    where: { id: streamId, providerId, status: "scheduled" },
    data: { status: "ended", endedAt: new Date() },
  });
  if (cancelled.count === 0) {
    return { ok: false, status: 409, error: "This live has already started or was cancelled." };
  }

  await notifyLiveAudience(providerId, (subscriberId) => ({
    recipientId: subscriberId,
    actorId: providerId,
    type: "live",
    title: `${stream.provider.displayName} cancelled a scheduled live`,
    body: stream.title,
    href: `/live/${streamId}`,
  }));
  return { ok: true };
}

const STARTING_SOON_WINDOW_MINUTES = 10;
const STARTING_SOON_LATE_GRACE_MINUTES = 10;
const SCHEDULED_NO_SHOW_GRACE_MINUTES = 120;

/**
 * Meant to run every 1-5 minutes (see vercel.json's live-starting-soon cron): sends the
 * "starting soon" nudge to a scheduled stream's subscribers and its own creator once, then
 * auto-ends any scheduled stream whose time has long passed with no one having gone live.
 */
export async function processScheduledLiveStreams(): Promise<{ notified: number; expired: number }> {
  const now = new Date();
  const expiryBoundary = new Date(now.getTime() - SCHEDULED_NO_SHOW_GRACE_MINUTES * 60 * 1000);

  const expiring = await prisma.liveStream.findMany({
    where: {
      status: "scheduled",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: expiryBoundary } }],
    },
    select: {
      id: true,
      title: true,
      providerId: true,
      scheduledFor: true,
      provider: { select: { displayName: true } },
    },
  });

  let expired = 0;
  for (const stream of expiring) {
    const claimed = await prisma.liveStream.updateMany({
      where: { id: stream.id, status: "scheduled" },
      data: { status: "ended", endedAt: now },
    });
    if (claimed.count === 0) continue;
    expired += 1;

    try {
      const subscriberIds = stream.scheduledFor ? await getActiveSubscriberIds(stream.providerId) : [];
      await createNotificationsBulk([
        ...subscriberIds.map((subscriberId) => ({
          recipientId: subscriberId,
          actorId: stream.providerId,
          type: "live" as const,
          title: `${stream.provider.displayName}'s scheduled live did not start`,
          body: stream.title,
          href: `/live/${stream.id}`,
        })),
        {
          recipientId: stream.providerId,
          type: "live" as const,
          title: "Your scheduled live expired",
          body: stream.scheduledFor
            ? "It was closed because it did not start within two hours of the scheduled time."
            : "It was closed because its scheduled time was missing.",
          href: "/live/go",
        },
      ]);
    } catch (error) {
      console.error("Scheduled live expiry notification failed", { streamId: stream.id, error });
    }
  }

  const startingSoon = await prisma.liveStream.findMany({
    where: {
      status: "scheduled",
      startingSoonNotifiedAt: null,
      scheduledFor: {
        gte: new Date(now.getTime() - STARTING_SOON_LATE_GRACE_MINUTES * 60 * 1000),
        lte: new Date(now.getTime() + STARTING_SOON_WINDOW_MINUTES * 60 * 1000),
      },
    },
    select: {
      id: true,
      title: true,
      providerId: true,
      scheduledFor: true,
      provider: { select: { displayName: true } },
    },
  });

  let notified = 0;
  for (const stream of startingSoon) {
    const claimed = await prisma.liveStream.updateMany({
      where: { id: stream.id, status: "scheduled", startingSoonNotifiedAt: null },
      data: { startingSoonNotifiedAt: now },
    });
    if (claimed.count === 0) continue;
    notified += 1;

    try {
      const subscriberIds = await getActiveSubscriberIds(stream.providerId);
      const isDue = Boolean(stream.scheduledFor && stream.scheduledFor <= now);
      await createNotificationsBulk(
        [
          ...subscriberIds.map((subscriberId) => ({
            recipientId: subscriberId,
            actorId: stream.providerId,
            type: "live" as const,
            title: isDue
              ? `${stream.provider.displayName}'s live is due to start`
              : `${stream.provider.displayName} is going live soon`,
            body: stream.title,
            href: `/live/${stream.id}`,
          })),
          {
            recipientId: stream.providerId,
            type: "live" as const,
            title: isDue ? "Your scheduled live is due" : "Your scheduled live starts soon",
            body: isDue ? "Open your live setup when you're ready to begin." : "Get ready - your audience has been reminded.",
            href: "/live/go",
          },
        ],
      );
    } catch (error) {
      console.error("Scheduled live reminder failed", { streamId: stream.id, error });
    }
  }

  return { notified, expired };
}

export type LiveStreamProviderSummary = { id: string; username: string; displayName: string; avatarUrl: string };

export type LiveStreamPageState =
  | { state: "not_found" }
  | { state: "ended" }
  | {
      state: "scheduled";
      streamId: string;
      title: string;
      scheduledFor: string;
      provider: LiveStreamProviderSummary;
      isHost: boolean;
    }
  | { state: "live_locked"; streamId: string; title: string; provider: LiveStreamProviderSummary }
  | {
      state: "live";
      streamId: string;
      title: string;
      startedAt: string;
      totalHeartsReceived: number;
      heartGoal: number | null;
      requestOptions: { id: string; label: string; hearts: number }[];
      provider: LiveStreamProviderSummary;
      token: string;
      livekitUrl: string;
      isHost: boolean;
    };

/**
 * Drives the public /live/[id] page for every visitor - logged in or not. Anonymous and
 * logged-out-of-the-account visitors get "scheduled" (a countdown) or "live_locked" (creator
 * info, prompted to log in to actually watch) instead of a token; only an authenticated
 * viewer on a genuinely live stream gets a real LiveKit token back.
 */
export async function getLiveStreamPageState(
  streamId: string,
  viewer: { id: string; displayName: string } | null,
): Promise<LiveStreamPageState> {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: {
      id: true,
      title: true,
      status: true,
      roomName: true,
      startedAt: true,
      scheduledFor: true,
      totalHeartsReceived: true,
      heartGoal: true,
      requestOptions: {
        where: { isEnabled: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, hearts: true },
      },
      provider: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
  if (!stream) return { state: "not_found" };

  if (stream.status === "scheduled") {
    if (!stream.scheduledFor) return { state: "ended" };
    return {
      state: "scheduled",
      streamId: stream.id,
      title: stream.title,
      scheduledFor: stream.scheduledFor.toISOString(),
      provider: stream.provider,
      isHost: viewer?.id === stream.provider.id,
    };
  }

  if (stream.status !== "live") {
    return { state: "ended" };
  }

  if (!viewer || !isLiveKitConfigured()) {
    return { state: "live_locked", streamId: stream.id, title: stream.title, provider: stream.provider };
  }

  const isHost = stream.provider.id === viewer.id;
  const token = await createLiveKitToken({
    roomName: stream.roomName,
    identity: viewer.id,
    name: viewer.displayName,
    canPublish: isHost,
  });

  return {
    state: "live",
    streamId: stream.id,
    title: stream.title,
    startedAt: stream.startedAt.toISOString(),
    totalHeartsReceived: stream.totalHeartsReceived,
    heartGoal: stream.heartGoal,
    requestOptions: stream.requestOptions,
    provider: stream.provider,
    token,
    livekitUrl: getLiveKitUrl(),
    isHost,
  };
}

export type EndLiveStreamResult = { ok: true } | { ok: false; status: number; error: string };

export async function endLiveStream(providerId: string, streamId: string, peakViewers = 0): Promise<EndLiveStreamResult> {
  const stream = await prisma.liveStream.findUnique({ where: { id: streamId }, select: { providerId: true, status: true, peakViewers: true } });
  if (!stream || stream.providerId !== providerId) {
    return { ok: false, status: 404, error: "Stream not found." };
  }
  if (stream.status !== "live") {
    return { ok: true };
  }

  await refundOpenLiveRequests(streamId);
  await prisma.liveStream.update({
    where: { id: streamId },
    data: { status: "ended", endedAt: new Date(), peakViewers: Math.max(stream.peakViewers, Math.max(0, Math.trunc(peakViewers))) },
  });
  await triggerEvent(liveStreamChannelName(streamId), LIVE_STREAM_ENDED_EVENT, {});
  return { ok: true };
}

export async function getActiveStreamForProvider(providerId: string) {
  return prisma.liveStream.findFirst({
    where: { providerId, status: "live" },
    select: { id: true, roomName: true, title: true, startedAt: true },
  });
}

export type JoinLiveStreamResult =
  | {
      ok: true;
      stream: {
        id: string;
        title: string;
        startedAt: string;
        totalHeartsReceived: number;
        heartGoal: number | null;
        requestOptions: { id: string; label: string; hearts: number }[];
        provider: { id: string; username: string; displayName: string; avatarUrl: string };
      };
      token: string;
      livekitUrl: string;
      isHost: boolean;
    }
  | { ok: false; status: number; error: string };

/** The viewer connects with publish rights when they're the stream's own provider (e.g. reconnecting after a refresh). */
export async function joinLiveStream(streamId: string, viewerId: string, viewerName: string): Promise<JoinLiveStreamResult> {
  if (!isLiveKitConfigured()) {
    return { ok: false, status: 503, error: "Live streaming isn't configured yet." };
  }

  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: {
      id: true,
      title: true,
      status: true,
      roomName: true,
      startedAt: true,
      totalHeartsReceived: true,
      heartGoal: true,
      requestOptions: {
        where: { isEnabled: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, hearts: true },
      },
      provider: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  if (!stream || stream.status !== "live") {
    return { ok: false, status: 404, error: "This stream has ended." };
  }

  const isHost = stream.provider.id === viewerId;
  const token = await createLiveKitToken({
    roomName: stream.roomName,
    identity: viewerId,
    name: viewerName,
    canPublish: isHost,
  });

  return {
    ok: true,
    stream: {
      id: stream.id,
      title: stream.title,
      startedAt: stream.startedAt.toISOString(),
      totalHeartsReceived: stream.totalHeartsReceived,
      heartGoal: stream.heartGoal,
      requestOptions: stream.requestOptions,
      provider: stream.provider,
    },
    token,
    livekitUrl: getLiveKitUrl(),
    isHost,
  };
}

export type LiveRingEntry = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isLive: boolean;
  streamId: string | null;
};

/** How many candidates to fetch per limit slot before ranking cuts it down - without this,
 * whoever ranking would have promoted never gets considered because a plain `take: limit`
 * chronological query already threw them away. */
const RING_CANDIDATE_MULTIPLIER = 3;

/** Session-stable ranking: a viewer refreshing within this window sees the same order, since
 * the score is a pure function of (viewer, candidate, bucket) - no persistence needed for a
 * ring this small and cheap to recompute, unlike the main feed's FeedSlate. */
const RING_SESSION_BUCKET_MINUTES = 15;

/** Mirrors lib/recommendations.ts's scoreProximity buckets, normalized to [0, 1] so it
 * combines cleanly with the other weighted terms below. */
function localityTerm(
  viewer: { locationLat: number; locationLng: number } | null,
  candidate: { locationLat: number; locationLng: number },
): number {
  if (!viewer) return 0;
  const viewerHasLocation = viewer.locationLat !== 0 || viewer.locationLng !== 0;
  const candidateHasLocation = candidate.locationLat !== 0 || candidate.locationLng !== 0;
  if (!viewerHasLocation || !candidateHasLocation) return 0;

  const distanceKm = haversineDistanceKm(viewer.locationLat, viewer.locationLng, candidate.locationLat, candidate.locationLng);
  if (distanceKm <= 10) return 1;
  if (distanceKm <= 25) return 0.75;
  if (distanceKm <= 50) return 0.5;
  if (distanceKm <= 100) return 0.25;
  if (distanceKm <= 250) return 0.1;
  return 0;
}

/** Newer accounts nudged up, decaying over a month rather than recommendation-scoring.ts's
 * 36-hour post-recency half-life - an account is "novel" on a much longer timescale than a
 * single post is "fresh". */
const RING_NOVELTY_HALF_LIFE_DAYS = 30;
function noveltyTerm(createdAt: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return Math.pow(0.5, ageDays / RING_NOVELTY_HALF_LIFE_DAYS);
}

/** Live activity right now - saturates like affinity/quality do elsewhere, so a handful of
 * early hearts doesn't already max this term out. Always 0 for a merely-online (not live)
 * candidate - there's no live-specific momentum signal for them. */
const MOMENTUM_SATURATION = 50;
function momentumTerm(totalHeartsReceived: number): number {
  if (totalHeartsReceived <= 0) return 0;
  return totalHeartsReceived / (totalHeartsReceived + MOMENTUM_SATURATION);
}

const RING_WEIGHTS = {
  affinity: 0.65,
  locality: 0.15,
  momentum: 0.1,
  novelty: 0.1,
};

type RingCandidate = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  locationLat: number;
  locationLng: number;
  createdAt: Date;
  totalHeartsReceived: number;
};

function rankRingCandidates(
  candidates: RingCandidate[],
  context: {
    viewerLocation: { locationLat: number; locationLng: number } | null;
    affinityByCreator: Map<string, number>;
    seed: string;
    now: Date;
  },
): RingCandidate[] {
  return [...candidates]
    .map((candidate) => {
      const score =
        RING_WEIGHTS.affinity * affinityTerm(context.affinityByCreator.get(candidate.id) ?? 0) +
        RING_WEIGHTS.locality * localityTerm(context.viewerLocation, candidate) +
        RING_WEIGHTS.momentum * momentumTerm(candidate.totalHeartsReceived) +
        RING_WEIGHTS.novelty * noveltyTerm(candidate.createdAt, context.now);
      return { candidate, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return seededTiebreak(context.seed, a.candidate.id) - seededTiebreak(context.seed, b.candidate.id);
    })
    .map((entry) => entry.candidate);
}

/**
 * Powers the Home ring row: everyone currently live (ranked among themselves), then
 * providers online for chat (ranked among themselves), self excluded. Live entries are
 * always shown ahead of merely-online ones - being live is the single strongest "worth
 * clicking now" signal, so ranking only reorders within each group rather than fully
 * interleaving them. Ranking itself is affinity (CreatorAffinity) -> locality -> momentum
 * (live heart activity) -> novelty (newer accounts), per the discovery/ranking plan,
 * session-stable via a deterministic seeded tiebreak so refreshing within the same
 * ~15-minute window doesn't reshuffle an otherwise-unchanged candidate set.
 */
export async function getLiveRingFeed(
  viewerProfileId: string | null,
  limit = 20,
  now: Date = new Date(),
): Promise<LiveRingEntry[]> {
  const notSelf = viewerProfileId ? { NOT: { id: viewerProfileId } } : {};
  const bucket = Math.floor(now.getTime() / (RING_SESSION_BUCKET_MINUTES * 60 * 1000));
  const seed = `${viewerProfileId ?? "anonymous"}:${bucket}`;

  const viewer = viewerProfileId
    ? await prisma.profile.findUnique({
        where: { id: viewerProfileId },
        select: { locationLat: true, locationLng: true },
      })
    : null;

  const liveStreamCandidates = await prisma.liveStream.findMany({
    where: { status: "live", provider: { isIncognito: false, isSuspended: false, showInSearch: true, ...notSelf } },
    orderBy: { startedAt: "desc" },
    take: limit * RING_CANDIDATE_MULTIPLIER,
    select: {
      id: true,
      totalHeartsReceived: true,
      provider: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, locationLat: true, locationLng: true, createdAt: true },
      },
    },
  });

  const liveCandidateProviderIds = new Set(liveStreamCandidates.map((s) => s.provider.id));
  const streamIdByProvider = new Map(liveStreamCandidates.map((s) => [s.provider.id, s.id]));

  const onlineCandidates = await prisma.profile.findMany({
    where: {
      ...notSelf,
      isIncognito: false,
      isSuspended: false,
      showInSearch: true,
      profileType: { in: [...CREATOR_PROFILE_TYPES] },
      id: { notIn: Array.from(liveCandidateProviderIds) },
      showActivityStatus: true,
      lastActiveAt: { gt: new Date(Date.now() - ONLINE_WINDOW_MS) },
    },
    orderBy: { lastActiveAt: "desc" },
    // Overfetch by the same multiplier regardless of how many live candidates came back -
    // the exact remaining slot count isn't known until after live candidates are ranked
    // (ranking reorders, it doesn't drop anyone), so this just needs enough headroom.
    take: limit * RING_CANDIDATE_MULTIPLIER,
    select: { id: true, username: true, displayName: true, avatarUrl: true, locationLat: true, locationLng: true, createdAt: true },
  });

  const affinityRows = viewerProfileId
    ? await prisma.creatorAffinity.findMany({
        where: {
          viewerId: viewerProfileId,
          creatorId: { in: [...Array.from(liveCandidateProviderIds), ...onlineCandidates.map((p) => p.id)] },
        },
        select: { creatorId: true, affinity: true },
      })
    : [];
  const affinityByCreator = new Map(affinityRows.map((row) => [row.creatorId, row.affinity]));

  const rankContext = { viewerLocation: viewer, affinityByCreator, seed, now };

  const rankedLive = rankRingCandidates(
    liveStreamCandidates.map((s) => ({
      id: s.provider.id,
      username: s.provider.username,
      displayName: s.provider.displayName,
      avatarUrl: s.provider.avatarUrl,
      locationLat: s.provider.locationLat,
      locationLng: s.provider.locationLng,
      createdAt: s.provider.createdAt,
      totalHeartsReceived: s.totalHeartsReceived,
    })),
    rankContext,
  ).slice(0, limit);

  const remaining = Math.max(0, limit - rankedLive.length);
  const rankedOnline = rankRingCandidates(
    onlineCandidates.map((p) => ({ ...p, totalHeartsReceived: 0 })),
    rankContext,
  ).slice(0, remaining);

  return [
    ...rankedLive.map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      isLive: true,
      streamId: streamIdByProvider.get(p.id) ?? null,
    })),
    ...rankedOnline.map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      isLive: false,
      streamId: null,
    })),
  ];
}

export type SendGiftResult =
  | { ok: true; heartsBalance: number; hearts: number }
  | { ok: false; status: number; error: string };

export async function sendGift(streamId: string, senderId: string, hearts: number): Promise<SendGiftResult> {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { id: true, status: true, providerId: true },
  });
  if (!stream || stream.status !== "live") {
    return { ok: false, status: 404, error: "This stream has ended." };
  }

  const result = await settleGift({ senderId, receiverId: stream.providerId, hearts, context: "live_stream", streamId });
  if (!result.ok) return result;

  await prisma.liveStream.update({ where: { id: streamId }, data: { totalHeartsReceived: { increment: hearts } } });
  await triggerEvent(liveStreamChannelName(streamId), LIVE_GIFT_SENT_EVENT, { hearts, sender: result.sender });

  return { ok: true, heartsBalance: result.heartsBalance, hearts };
}
