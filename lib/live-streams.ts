import "server-only";

import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { isProviderProfileType, PROVIDER_PROFILE_TYPES } from "@/lib/provider-types";
import { createLiveKitToken, getLiveKitUrl, isLiveKitConfigured } from "@/lib/livekit";
import { triggerEvent } from "@/lib/pusher-server";
import { liveStreamChannelName, LIVE_GIFT_SENT_EVENT, LIVE_STREAM_ENDED_EVENT } from "@/lib/live-stream-channels";
import { HEART_UNIT_PRICE_CENTS } from "@/lib/hearts-shared";

/** Share of a gift's cash value credited to the receiving provider's withdrawable wallet — same split as the subscription rewards pool (lib/rewards/earnings.ts). */
export const GIFT_PROVIDER_SHARE = 0.7;

/** How long since lastActiveAt counts as "online" for the chat-only ring (no live badge). */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** Guards against a fat-fingered or abusive single gift. */
const MAX_HEARTS_PER_GIFT = 10_000;

function generateRoomName(): string {
  return `live-${randomBytes(12).toString("hex")}`;
}

export type StartLiveStreamResult =
  | { ok: true; stream: { id: string; roomName: string; title: string }; token: string; livekitUrl: string }
  | { ok: false; status: number; error: string };

export async function startLiveStream(providerId: string, title: string): Promise<StartLiveStreamResult> {
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
  const stream =
    existing ??
    (await prisma.liveStream.create({
      data: { providerId, title: title.trim().slice(0, 120) || `${profile.displayName}'s live stream`, roomName: generateRoomName() },
      select: { id: true, roomName: true, title: true },
    }));

  const token = await createLiveKitToken({
    roomName: stream.roomName,
    identity: providerId,
    name: profile.displayName,
    canPublish: true,
  });

  return { ok: true, stream, token, livekitUrl: getLiveKitUrl() };
}

export type EndLiveStreamResult = { ok: true } | { ok: false; status: number; error: string };

export async function endLiveStream(providerId: string, streamId: string): Promise<EndLiveStreamResult> {
  const stream = await prisma.liveStream.findUnique({ where: { id: streamId }, select: { providerId: true, status: true } });
  if (!stream || stream.providerId !== providerId) {
    return { ok: false, status: 404, error: "Stream not found." };
  }
  if (stream.status !== "live") {
    return { ok: true };
  }

  await prisma.liveStream.update({ where: { id: streamId }, data: { status: "ended", endedAt: new Date() } });
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
      stream: { id: string; title: string; provider: { id: string; username: string; displayName: string; avatarUrl: string } };
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
    stream: { id: stream.id, title: stream.title, provider: stream.provider },
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
          profileType: { in: [...PROVIDER_PROFILE_TYPES] },
          id: { notIn: Array.from(liveProviderIds) },
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
  if (!Number.isInteger(hearts) || hearts <= 0 || hearts > MAX_HEARTS_PER_GIFT) {
    return { ok: false, status: 400, error: "Invalid gift amount." };
  }

  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { id: true, status: true, providerId: true },
  });
  if (!stream || stream.status !== "live") {
    return { ok: false, status: 404, error: "This stream has ended." };
  }
  if (stream.providerId === senderId) {
    return { ok: false, status: 400, error: "You can't send yourself a gift." };
  }

  const sender = await prisma.profile.findUnique({ where: { id: senderId }, select: { heartsBalance: true, username: true, displayName: true, avatarUrl: true } });
  if (!sender || sender.heartsBalance < hearts) {
    return { ok: false, status: 402, error: "Not enough hearts. Buy more to keep sending gifts." };
  }

  const valueCents = hearts * HEART_UNIT_PRICE_CENTS;
  const providerShareCents = Math.round(valueCents * GIFT_PROVIDER_SHARE);

  const [updatedSender] = await prisma.$transaction([
    prisma.profile.update({
      where: { id: senderId },
      data: { heartsBalance: { decrement: hearts } },
      select: { heartsBalance: true },
    }),
    prisma.profile.update({
      where: { id: stream.providerId },
      data: { walletBalanceCents: { increment: providerShareCents } },
    }),
    prisma.liveStream.update({
      where: { id: streamId },
      data: { totalHeartsReceived: { increment: hearts } },
    }),
    prisma.gift.create({
      data: {
        streamId,
        senderId,
        receiverId: stream.providerId,
        hearts,
        valueCents,
        providerShareCents,
      },
    }),
  ]);

  await triggerEvent(liveStreamChannelName(streamId), LIVE_GIFT_SENT_EVENT, {
    hearts,
    sender: { username: sender.username, displayName: sender.displayName, avatarUrl: sender.avatarUrl },
  });

  return { ok: true, heartsBalance: updatedSender.heartsBalance, hearts };
}
