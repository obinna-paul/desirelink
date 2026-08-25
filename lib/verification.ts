import { prisma } from "@/lib/prisma";

export const VERIFICATION_REQUEST_TYPES = ["creator", "host"] as const;
export type VerificationRequestType = (typeof VERIFICATION_REQUEST_TYPES)[number];

export function isVerificationRequestType(value: unknown): value is VerificationRequestType {
  return typeof value === "string" && (VERIFICATION_REQUEST_TYPES as readonly string[]).includes(value);
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
    select: { profileType: true, isVerifiedCreator: true, isVerifiedHost: true },
  });
  if (!profile) {
    return { ok: false, status: 404, error: "Profile not found" };
  }

  if (requestType === "creator") {
    if (profile.profileType !== "CREATOR") {
      return { ok: false, status: 403, error: "Switch to a Creator account before requesting creator verification" };
    }
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

  const existingPending = await prisma.verificationRequest.findFirst({
    where: { profileId, requestType, status: "pending" },
    select: { id: true },
  });
  if (existingPending) {
    return { ok: false, status: 400, error: "You already have a pending request of this type" };
  }

  const request = await prisma.verificationRequest.create({
    data: { profileId, requestType, govIdUrl, selfieUrl, status: "pending" },
  });

  return { ok: true, requestId: request.id };
}

export async function getMyVerificationRequests(profileId: string) {
  return prisma.verificationRequest.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
  });
}

const verificationProfileSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export async function getPendingVerificationRequests() {
  return prisma.verificationRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { profile: { select: verificationProfileSelect } },
  });
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
