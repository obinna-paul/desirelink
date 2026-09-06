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

/** Powers the Home ring row: everyone currently live, then providers online for chat, self excluded. */
export async function getLiveRingFeed(viewerProfileId: string | null, limit = 20): Promise<LiveRingEntry[]> {
  const notSelf = viewerProfileId ? { NOT: { id: viewerProfileId } } : {};

  const liveStreams = await prisma.liveStream.findMany({
    where: { status: "live", provider: { isIncognito: false, ...notSelf } },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      provider: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  const liveProviderIds = new Set(liveStreams.map((s) => s.provider.id));
  const remaining = Math.max(0, limit - liveStreams.length);

  const onlineProviders = remaining
    ? await prisma.profile.findMany({
        where: {
          ...notSelf,
          isIncognito: false,
          profileType: { in: [...CREATOR_PROFILE_TYPES] },
          id: { notIn: Array.from(liveProviderIds) },
          showActivityStatus: true,
          lastActiveAt: { gt: new Date(Date.now() - ONLINE_WINDOW_MS) },
        },
        orderBy: { lastActiveAt: "desc" },
        take: remaining,
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      })
    : [];

  return [
    ...liveStreams.map((s) => ({
      id: s.provider.id,
      username: s.provider.username,
      displayName: s.provider.displayName,
      avatarUrl: s.provider.avatarUrl,
      isLive: true,
      streamId: s.id,
    })),
    ...onlineProviders.map((p) => ({
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
