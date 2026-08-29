import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const VERIFICATION_REQUEST_TYPES = ["creator", "host"] as const;
export type VerificationRequestType = (typeof VERIFICATION_REQUEST_TYPES)[number];

export function isVerificationRequestType(value: unknown): value is VerificationRequestType {
  return typeof value === "string" && (VERIFICATION_REQUEST_TYPES as readonly string[]).includes(value);
}

function isMissingVerificationSchema(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022") &&
    String(error.meta?.table ?? error.meta?.column ?? "").includes("VerificationRequest")
  );
}

export type SubmitVerificationResult =
  | { ok: true; requestId: string }
  | { ok: false; status: number; error: string };

export async function submitVerificationRequest(
  profileId: string,
  requestType: VerificationRequestType,
  govIdUrl: string,
  selfieUrl: string
): Promise<SubmitVerificationResult> {
  if (!govIdUrl.trim() || !selfieUrl.trim()) {
    return { ok: false, status: 400, error: "Upload both a government ID and a selfie" };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { isVerifiedCreator: true, isVerifiedHost: true },
  });
  if (!profile) {
    return { ok: false, status: 404, error: "Profile not found" };
  }

  if (requestType === "creator") {
    if (profile.isVerifiedCreator) {
      return { ok: false, status: 400, error: "You're already a verified creator" };
    }
  } else {
    const hostedEventCount = await prisma.event.count({ where: { hostId: profileId } });
    if (hostedEventCount === 0) {
      return { ok: false, status: 403, error: "Host at least one event before requesting host verification" };
    }
    if (profile.isVerifiedHost) {
      return { ok: false, status: 400, error: "You're already a verified host" };
    }
  }

  let existingPending: { id: string } | null = null;
  try {
    existingPending = await prisma.verificationRequest.findFirst({
      where: { profileId, requestType, status: "pending" },
      select: { id: true },
    });
  } catch (error) {
    if (isMissingVerificationSchema(error)) {
      return { ok: false, status: 503, error: "Verification requests are unavailable until the database repair is applied" };
    }
    throw error;
  }
  if (existingPending) {
    return { ok: false, status: 400, error: "You already have a pending request of this type" };
  }

  const request = await prisma.verificationRequest.create({
    data: { profileId, requestType, govIdUrl, selfieUrl, status: "pending" },
  });

  return { ok: true, requestId: request.id };
}

export async function getMyVerificationRequests(profileId: string) {
  try {
    return await prisma.verificationRequest.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (isMissingVerificationSchema(error)) {
      console.warn("Verification requests are unavailable until VerificationRequest migrations are applied.");
      return [];
    }
    throw error;
  }
}

const verificationProfileSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export async function getPendingVerificationRequests() {
  try {
    return await prisma.verificationRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { profile: { select: verificationProfileSelect } },
    });
  } catch (error) {
    if (isMissingVerificationSchema(error)) {
      console.warn("Admin verification queue is unavailable until VerificationRequest migrations are applied.");
      return [];
    }
    throw error;
  }
}

export type PendingVerificationRequest = Awaited<ReturnType<typeof getPendingVerificationRequests>>[number];

export type ReviewVerificationResult = { ok: true } | { ok: false; status: number; error: string };

export async function approveVerificationRequest(
  requestId: string,
  reviewerId: string
): Promise<ReviewVerificationResult> {
  const request = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    return { ok: false, status: 404, error: "Request not found" };
  }
  if (request.status !== "pending") {
    return { ok: false, status: 400, error: "Request has already been reviewed" };
  }

  await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id: requestId },
      data: { status: "approved", reviewerId, reviewedAt: new Date() },
    }),
    prisma.profile.update({
      where: { id: request.profileId },
      data:
        request.requestType === "creator" ? { isVerifiedCreator: true } : { isVerifiedHost: true },
    }),
  ]);

  return { ok: true };
}

export async function denyVerificationRequest(
  requestId: string,
  reviewerId: string
): Promise<ReviewVerificationResult> {
  const request = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    return { ok: false, status: 404, error: "Request not found" };
  }
  if (request.status !== "pending") {
    return { ok: false, status: 400, error: "Request has already been reviewed" };
  }

  await prisma.verificationRequest.update({
    where: { id: requestId },
    data: { status: "denied", reviewerId, reviewedAt: new Date() },
  });

  return { ok: true };
}
