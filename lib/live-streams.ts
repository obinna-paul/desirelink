import "server-only";

import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { isProviderProfileType, CREATOR_PROFILE_TYPES } from "@/lib/provider-types";
import { createLiveKitToken, getLiveKitUrl, isLiveKitConfigured } from "@/lib/livekit";
import { triggerEvent } from "@/lib/pusher-server";
import { liveStreamChannelName, LIVE_GIFT_SENT_EVENT, LIVE_STREAM_ENDED_EVENT } from "@/lib/live-stream-channels";
import { settleGift } from "@/lib/hearts";
import { refundOpenLiveRequests, type LiveRequestOptionInput } from "@/lib/live-requests";
import { createNotificationsBulk } from "@/lib/notifications";
import { ONLINE_WINDOW_MS } from "@/lib/presence";

function generateRoomName(): string {
  return `live-${randomBytes(12).toString("hex")}`;
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
    return { ok: false, status: 403, error: "Only providers can host a live stream." };
  }

  const existing = await prisma.liveStream.findFirst({
    where: { providerId, status: "live" },
    select: { id: true, roomName: true, title: true },
  });
  const streamTitle = title.trim().slice(0, 120) || `${profile.displayName}'s live stream`;
  const stream =
    existing ??
    (await prisma.liveStream.create({
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
    }));

  // Only alert subscribers for a stream that's genuinely just starting - reconnecting to an
  // already-live session (e.g. a page refresh) hits the `existing` branch and must stay silent.
  if (!existing && notifySubscribers) {
    const subscribers = await prisma.subscription.findMany({
      where: { creatorId: providerId, status: "active" },
      select: { subscriberId: true },
    });
    if (subscribers.length > 0) {
      await createNotificationsBulk(
        subscribers.map(({ subscriberId }) => ({
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
