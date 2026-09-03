import "server-only";

import { LiveRequestStatus, Prisma } from "@prisma/client";

import { HEART_UNIT_PRICE_CENTS } from "@/lib/hearts-shared";
import { getUserChannelName } from "@/lib/message-channels";
import { prisma } from "@/lib/prisma";
import { triggerEvent } from "@/lib/pusher-server";
import { creditProviderWallet } from "@/lib/wallet";
import {
  LIVE_REQUEST_CREATED_EVENT,
  LIVE_REQUEST_COMPLETED_EVENT,
  LIVE_REQUEST_UPDATED_EVENT,
  liveStreamChannelName,
  liveHostChannelName,
} from "@/lib/live-stream-channels";

export const LIVE_REQUEST_MAX_OPTIONS = 8;
export const LIVE_REQUEST_MAX_HEARTS = 10_000;
export const LIVE_REQUEST_EXPIRY_MINUTES = 10;

export type LiveRequestOptionInput = { label: string; hearts: number };

export type LiveRequestView = {
  id: string;
  label: string;
  hearts: number;
  status: LiveRequestStatus;
  createdAt: string;
  expiresAt: string;
  requester: { id: string; username: string; displayName: string; avatarUrl: string };
};

const REQUEST_SELECT = {
  id: true,
  label: true,
  hearts: true,
  status: true,
  createdAt: true,
  expiresAt: true,
  requester: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.LiveRequestSelect;

function serializeRequest(request: {
  id: string;
  label: string;
  hearts: number;
  status: LiveRequestStatus;
  createdAt: Date;
  expiresAt: Date;
  requester: { id: string; username: string; displayName: string; avatarUrl: string };
}): LiveRequestView {
  return {
    ...request,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
  };
}

/**
 * Viewer requests are optional - a creator can go live with none. Rows left completely
 * blank (no label, no price) are treated as unused slots and dropped rather than rejected;
 * a row with only one side filled in is a genuine mistake and still fails validation.
 */
export function normalizeLiveRequestOptions(value: unknown):
  | { ok: true; options: LiveRequestOptionInput[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: true, options: [] };
  }

  const rows = value.map((item) => ({
    label: typeof item?.label === "string" ? item.label.trim().slice(0, 60) : "",
    hearts: typeof item?.hearts === "number" ? Math.trunc(item.hearts) : Number.NaN,
  }));
  const options = rows.filter((row) => row.label || Number.isInteger(row.hearts));

  if (options.length > LIVE_REQUEST_MAX_OPTIONS) {
    return { ok: false, error: `Add up to ${LIVE_REQUEST_MAX_OPTIONS} request options.` };
  }
  if (options.some((option) => !option.label)) {
    return { ok: false, error: "Give every request a short name." };
  }
  if (options.some((option) => !Number.isInteger(option.hearts) || option.hearts < 1 || option.hearts > LIVE_REQUEST_MAX_HEARTS)) {
    return { ok: false, error: `Request prices must be between 1 and ${LIVE_REQUEST_MAX_HEARTS.toLocaleString()} hearts.` };
  }

  const uniqueLabels = new Set(options.map((option) => option.label.toLocaleLowerCase()));
  if (uniqueLabels.size !== options.length) {
    return { ok: false, error: "Each request needs a different name." };
  }

  return { ok: true, options };
}

export async function getLiveRequestPresets(providerId: string): Promise<LiveRequestOptionInput[]> {
  return prisma.liveRequestPreset.findMany({
    where: { providerId, isEnabled: true },
    orderBy: { sortOrder: "asc" },
    take: LIVE_REQUEST_MAX_OPTIONS,
    select: { label: true, hearts: true },
  });
}

export async function saveLiveRequestPresets(providerId: string, options: LiveRequestOptionInput[]) {
  await prisma.$transaction(async (tx) => {
    await tx.liveRequestPreset.deleteMany({ where: { providerId } });
    await tx.liveRequestPreset.createMany({
      data: options.map((option, sortOrder) => ({ providerId, ...option, sortOrder })),
    });
  });
}

export async function getLiveRequests(streamId: string, profileId: string) {
  await expireLiveRequests(streamId);
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { providerId: true },
  });
  if (!stream) return { ok: false as const, status: 404, error: "Stream not found." };

  const requests = await prisma.liveRequest.findMany({
    where: stream.providerId === profileId ? { streamId } : { streamId, requesterId: profileId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: REQUEST_SELECT,
  });
  return { ok: true as const, requests: requests.map(serializeRequest), isHost: stream.providerId === profileId };
}

export async function createLiveRequest(streamId: string, optionId: string, requesterId: string) {
  const option = await prisma.liveRequestOption.findFirst({
    where: { id: optionId, streamId, isEnabled: true },
    select: {
      id: true,
      label: true,
      hearts: true,
      stream: { select: { status: true, providerId: true } },
    },
  });
  if (!option || option.stream.status !== "live") {
    return { ok: false as const, status: 404, error: "That request is no longer available." };
  }
  if (option.stream.providerId === requesterId) {
    return { ok: false as const, status: 400, error: "You can't request from your own stream." };
  }

  const expiresAt = new Date(Date.now() + LIVE_REQUEST_EXPIRY_MINUTES * 60 * 1000);

  try {
    const request = await prisma.$transaction(async (tx) => {
      const debited = await tx.profile.updateMany({
        where: { id: requesterId, heartsBalance: { gte: option.hearts } },
        data: { heartsBalance: { decrement: option.hearts } },
      });
      if (debited.count !== 1) throw new Error("INSUFFICIENT_HEARTS");

      return tx.liveRequest.create({
        data: {
          streamId,
          optionId: option.id,
          requesterId,
          providerId: option.stream.providerId,
          label: option.label,
          hearts: option.hearts,
          valueCents: option.hearts * HEART_UNIT_PRICE_CENTS,
          expiresAt,
        },
        select: REQUEST_SELECT,
      });
    });

    const serialized = serializeRequest(request);
    await Promise.all([
      triggerEvent(liveHostChannelName(streamId), LIVE_REQUEST_CREATED_EVENT, serialized),
      triggerEvent(getUserChannelName(requesterId), LIVE_REQUEST_UPDATED_EVENT, serialized),
    ]);
    return { ok: true as const, request: serialized };
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_HEARTS") {
      return { ok: false as const, status: 402, error: "Not enough hearts for this request." };
    }
    throw error;
  }
}

type LiveRequestAction = "accept" | "decline" | "complete";

export async function updateLiveRequest(requestId: string, providerId: string, action: LiveRequestAction) {
  const current = await prisma.liveRequest.findUnique({
    where: { id: requestId },
    select: { id: true, requesterId: true, providerId: true, streamId: true, status: true, hearts: true, valueCents: true, expiresAt: true },
  });
  if (!current || current.providerId !== providerId) {
    return { ok: false as const, status: 404, error: "Request not found." };
  }
  if ((current.status === "pending" || current.status === "accepted") && current.expiresAt.getTime() <= Date.now()) {
    await expireLiveRequests(current.streamId);
    return { ok: false as const, status: 409, error: "This request expired and the hearts were refunded." };
  }

  const allowed =
    (action === "accept" && current.status === "pending") ||
    (action === "decline" && (current.status === "pending" || current.status === "accepted")) ||
    (action === "complete" && current.status === "accepted");
  if (!allowed) {
    return { ok: false as const, status: 409, error: "This request has already changed." };
  }

  const nextStatus: LiveRequestStatus = action === "accept" ? "accepted" : action === "decline" ? "declined" : "completed";
  const now = new Date();

  const request = await prisma.$transaction(async (tx) => {
    const changed = await tx.liveRequest.updateMany({
      where: { id: requestId, status: current.status },
      data: {
        status: nextStatus,
        respondedAt: action === "accept" || action === "decline" ? now : undefined,
        completedAt: action === "complete" ? now : undefined,
        refundedAt: action === "decline" ? now : undefined,
      },
    });
    if (changed.count !== 1) throw new Error("REQUEST_CHANGED");

    if (action === "decline") {
      await tx.profile.update({ where: { id: current.requesterId }, data: { heartsBalance: { increment: current.hearts } } });
    }
    if (action === "complete") {
      await creditProviderWallet(providerId, current.valueCents, tx);
      await tx.liveStream.update({
        where: { id: current.streamId },
        data: { totalHeartsReceived: { increment: current.hearts }, completedRequests: { increment: 1 } },
      });
    }

    return tx.liveRequest.findUniqueOrThrow({ where: { id: requestId }, select: REQUEST_SELECT });
  }).catch((error) => {
    if (error instanceof Error && error.message === "REQUEST_CHANGED") return null;
    throw error;
  });

  if (!request) return { ok: false as const, status: 409, error: "This request has already changed." };

  const serialized = serializeRequest(request);
  await Promise.all([
    triggerEvent(liveHostChannelName(current.streamId), LIVE_REQUEST_UPDATED_EVENT, serialized),
    triggerEvent(getUserChannelName(current.requesterId), LIVE_REQUEST_UPDATED_EVENT, serialized),
  ]);
  if (action === "complete") {
    await triggerEvent(liveStreamChannelName(current.streamId), LIVE_REQUEST_COMPLETED_EVENT, {
      id: serialized.id,
      label: serialized.label,
      hearts: serialized.hearts,
      requester: serialized.requester,
    });
  }
  return { ok: true as const, request: serialized };
}

export async function expireLiveRequests(streamId: string) {
  const expired = await prisma.liveRequest.findMany({
    where: { streamId, status: { in: ["pending", "accepted"] }, expiresAt: { lte: new Date() } },
    select: { id: true, requesterId: true, hearts: true },
  });
  if (expired.length === 0) return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const request of expired) {
      const changed = await tx.liveRequest.updateMany({
        where: { id: request.id, status: { in: ["pending", "accepted"] } },
        data: { status: "expired", refundedAt: now },
      });
      if (changed.count === 1) {
        await tx.profile.update({ where: { id: request.requesterId }, data: { heartsBalance: { increment: request.hearts } } });
      }
    }
  });

  await Promise.all(
    expired.map((request) =>
      triggerEvent(getUserChannelName(request.requesterId), LIVE_REQUEST_UPDATED_EVENT, { id: request.id, status: "expired" }),
    ),
  );
}

export async function refundOpenLiveRequests(streamId: string) {
  const open = await prisma.liveRequest.findMany({
    where: { streamId, status: { in: ["pending", "accepted"] } },
    select: { id: true, requesterId: true, hearts: true },
  });
  if (open.length === 0) return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const request of open) {
      const changed = await tx.liveRequest.updateMany({
        where: { id: request.id, status: { in: ["pending", "accepted"] } },
        data: { status: "refunded", refundedAt: now },
      });
      if (changed.count === 1) {
        await tx.profile.update({
          where: { id: request.requesterId },
          data: { heartsBalance: { increment: request.hearts } },
        });
      }
    }
  });

  await Promise.all(
    open.map((request) =>
      triggerEvent(getUserChannelName(request.requesterId), LIVE_REQUEST_UPDATED_EVENT, {
        id: request.id,
        status: "refunded",
      }),
    ),
  );
}
