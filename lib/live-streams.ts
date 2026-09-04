import "server-only";

import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { isProviderProfileType, CREATOR_PROFILE_TYPES } from "@/lib/provider-types";
import { createLiveKitToken, getLiveKitUrl, isLiveKitConfigured } from "@/lib/livekit";
import { triggerEvent } from "@/lib/pusher-server";
import { liveStreamChannelName, LIVE_GIFT_SENT_EVENT, LIVE_STREAM_ENDED_EVENT } from "@/lib/live-stream-channels";
import { settleGift } from "@/lib/hearts";
import { refundOpenLiveRequests, type LiveRequestOptionInput } from "@/lib/live-requests";
import { createNotification, createNotificationsBulk } from "@/lib/notifications";
import { getActiveSubscriberIds } from "@/lib/subscription-access";
import { ONLINE_WINDOW_MS } from "@/lib/presence";
import { hasIdentityOnFile } from "@/lib/verification";

function generateRoomName(): string {
  return `live-${randomBytes(12).toString("hex")}`;
}

function formatScheduledTime(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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

  // A "scheduled" row for this provider is reused (same id, same shareable link) rather than
  // creating a second stream - whoever already has the link keeps working once they go live.
  const existing = await prisma.liveStream.findFirst({
    where: { providerId, status: { in: ["live", "scheduled"] } },
    select: { id: true, roomName: true, title: true, status: true },
  });
  const streamTitle = title.trim().slice(0, 120) || `${profile.displayName}'s live stream`;
  const isBrandNew = !existing;
  const isStartingScheduled = existing?.status === "scheduled";

  let stream: { id: string; roomName: string; title: string };
  if (existing && existing.status === "scheduled") {
    stream = await prisma.liveStream.update({
      where: { id: existing.id },
      data: {
        status: "live",
        startedAt: new Date(),
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
  } else if (existing) {
    stream = existing;
  } else {
    stream = await prisma.liveStream.create({
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
  }

  // Only alert subscribers for a stream that's genuinely just starting now, brand new or
  // freshly promoted from scheduled - reconnecting to an already-live session (e.g. a page
  // refresh) hits the plain `existing` branch above and must stay silent.
  if ((isBrandNew || isStartingScheduled) && notifySubscribers) {
    const subscriberIds = await getActiveSubscriberIds(providerId);
    if (subscriberIds.length > 0) {
      await createNotificationsBulk(
        subscriberIds.map((subscriberId) => ({
          recipientId: subscriberId,
          actorId: providerId,
          type: "live" as const,
          title: `${profile.displayName} is live`,
          body: streamTitle,
          href: `/live/${stream.id}`,
        })),
      );
    }
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

  const now = Date.now();
  if (scheduledFor.getTime() < now + MIN_SCHEDULE_LEAD_MINUTES * 60 * 1000) {
    return { ok: false, status: 400, error: `Schedule at least ${MIN_SCHEDULE_LEAD_MINUTES} minutes from now.` };
  }
  if (scheduledFor.getTime() > now + MAX_SCHEDULE_LEAD_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, status: 400, error: `Schedule within the next ${MAX_SCHEDULE_LEAD_DAYS} days.` };
  }

  const existing = await prisma.liveStream.findFirst({
    where: { providerId, status: { in: ["live", "scheduled"] } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, status: 400, error: "You already have a live stream in progress or scheduled." };
  }

  const streamTitle = title.trim().slice(0, 120) || `${profile.displayName}'s live stream`;
  const stream = await prisma.liveStream.create({
    data: {
      providerId,
      title: streamTitle,
      status: "scheduled",
      roomName: generateRoomName(),
      scheduledFor,
    },
    select: { id: true, roomName: true, title: true, scheduledFor: true },
  });

  const subscriberIds = await getActiveSubscriberIds(providerId);
  if (subscriberIds.length > 0) {
    await createNotificationsBulk(
      subscriberIds.map((subscriberId) => ({
        recipientId: subscriberId,
        actorId: providerId,
        type: "live" as const,
        title: `${profile.displayName} scheduled a live`,
        body: `${streamTitle} - ${formatScheduledTime(scheduledFor)}`,
        href: `/live/${stream.id}`,
      })),
    );
  }

  return {
    ok: true,
    stream: { id: stream.id, roomName: stream.roomName, title: stream.title, scheduledFor: stream.scheduledFor!.toISOString() },
  };
}

export async function getScheduledStreamForProvider(providerId: string) {
  return prisma.liveStream.findFirst({
    where: { providerId, status: "scheduled" },
    select: { id: true, title: true, scheduledFor: true },
  });
}

export type CancelScheduledStreamResult = { ok: true } | { ok: false; status: number; error: string };

export async function cancelScheduledLiveStream(providerId: string, streamId: string): Promise<CancelScheduledStreamResult> {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { providerId: true, status: true },
  });
  if (!stream || stream.providerId !== providerId) {
    return { ok: false, status: 404, error: "Scheduled stream not found." };
  }
  if (stream.status !== "scheduled") {
    return { ok: false, status: 400, error: "This stream isn't scheduled." };
  }

  await prisma.liveStream.update({ where: { id: streamId }, data: { status: "ended", endedAt: new Date() } });
  return { ok: true };
}

const STARTING_SOON_WINDOW_MINUTES = 10;
const SCHEDULED_NO_SHOW_GRACE_MINUTES = 120;

/**
 * Meant to run every 1-5 minutes (see vercel.json's live-starting-soon cron): sends the
 * "starting soon" nudge to a scheduled stream's subscribers and its own creator once, then
 * auto-ends any scheduled stream whose time has long passed with no one having gone live.
 */
export async function processScheduledLiveStreams(): Promise<{ notified: number; expired: number }> {
  const now = new Date();

  const startingSoon = await prisma.liveStream.findMany({
    where: {
      status: "scheduled",
      startingSoonNotifiedAt: null,
      scheduledFor: { lte: new Date(now.getTime() + STARTING_SOON_WINDOW_MINUTES * 60 * 1000) },
    },
    select: {
      id: true,
      title: true,
      providerId: true,
      provider: { select: { displayName: true } },
    },
  });

  for (const stream of startingSoon) {
    const subscriberIds = await getActiveSubscriberIds(stream.providerId);
    if (subscriberIds.length > 0) {
      await createNotificationsBulk(
        subscriberIds.map((subscriberId) => ({
          recipientId: subscriberId,
          actorId: stream.providerId,
          type: "live" as const,
          title: `${stream.provider.displayName} is going live soon`,
          body: stream.title,
          href: `/live/${stream.id}`,
        })),
      );
    }
    await createNotification({
      recipientId: stream.providerId,
      type: "live",
      title: "Your scheduled live starts soon",
      body: "Get ready - your audience has been notified too.",
      href: `/live/${stream.id}`,
    });
    await prisma.liveStream.update({ where: { id: stream.id }, data: { startingSoonNotifiedAt: now } });
  }

  const expired = await prisma.liveStream.updateMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: new Date(now.getTime() - SCHEDULED_NO_SHOW_GRACE_MINUTES * 60 * 1000) },
    },
    data: { status: "ended", endedAt: now },
  });

  return { notified: startingSoon.length, expired: expired.count };
}

export type LiveStreamProviderSummary = { id: string; username: string; displayName: string; avatarUrl: string };

export type LiveStreamPageState =
  | { state: "not_found" }
  | { state: "ended" }
  | { state: "scheduled"; streamId: string; title: string; scheduledFor: string; provider: LiveStreamProviderSummary }
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
    return {
      state: "scheduled",
      streamId: stream.id,
      title: stream.title,
      scheduledFor: stream.scheduledFor!.toISOString(),
      provider: stream.provider,
    };
  }

  if (stream.status === "ended") {
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
