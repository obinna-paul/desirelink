import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { recordAdminAction } from "@/lib/admin/audit";

export const VERIFICATION_REQUEST_TYPES = [
  "creator",
  "service_provider",
] as const;
export type VerificationRequestType =
  (typeof VERIFICATION_REQUEST_TYPES)[number];

export function isVerificationRequestType(
  value: unknown,
): value is VerificationRequestType {
  return (
    typeof value === "string" &&
    (VERIFICATION_REQUEST_TYPES as readonly string[]).includes(value)
  );
}

function isMissingVerificationSchema(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022") &&
    String(error.meta?.table ?? error.meta?.column ?? "").includes(
      "VerificationRequest",
    )
  );
}

export type SubmitVerificationResult =
  | { ok: true; requestId: string }
  | { ok: false; status: number; error: string };

export async function submitVerificationRequest(
  profileId: string,
  requestType: VerificationRequestType,
  govIdUrl: string,
  selfieUrl: string,
): Promise<SubmitVerificationResult> {
  if (!govIdUrl.trim() || !selfieUrl.trim()) {
    return {
      ok: false,
      status: 400,
      error: "Upload both a government ID and a selfie",
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      profileType: true,
      isVerifiedCreator: true,
      isVerifiedServiceProvider: true,
    },
  });
  if (!profile) {
    return { ok: false, status: 404, error: "Profile not found" };
  }

  if (!isProviderProfileType(profile.profileType)) {
    return {
      ok: false,
      status: 403,
      error: "Switch to a creator account before verifying",
    };
  }

  if (requestType === "creator" && profile.isVerifiedCreator) {
    return {
      ok: false,
      status: 400,
      error: "You're already a verified creator",
    };
  }
  if (requestType === "service_provider" && profile.isVerifiedServiceProvider) {
    return {
      ok: false,
      status: 400,
      error: "You're already a verified service provider",
    };
  }

  let existingPending: { id: string } | null = null;
  try {
    existingPending = await prisma.verificationRequest.findFirst({
      where: { profileId, requestType, status: "pending" },
      select: { id: true },
    });
  } catch (error) {
    if (isMissingVerificationSchema(error)) {
      return {
        ok: false,
        status: 503,
        error:
          "Verification requests are unavailable until the database repair is applied",
      };
    }
    throw error;
  }
  if (existingPending) {
    return {
      ok: false,
      status: 400,
      error: "You already have a pending request of this type",
    };
  }

  const [request] = await prisma.$transaction([
    prisma.verificationRequest.create({
      data: { profileId, requestType, govIdUrl, selfieUrl, status: "pending" },
    }),
    prisma.profile.update({
      where: { id: profileId },
      data: { verificationPending: true },
    }),
  ]);

  return { ok: true, requestId: request.id };
}

/**
 * A single unified "identity on file" check that drives every verification gate
 * (listing services, posting premium content). Submitting ANY one of the request
 * types satisfies all of them - identity verification is one process, not
 * several - and having ever submitted (even while pending review) is
 * enough to proceed; only a denied request (which also suspends the account, see
 * denyVerificationRequest) blocks further action, via the separate isSuspended checks.
 */
export async function hasIdentityOnFile(profileId: string): Promise<boolean> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      isVerified: true,
      isVerifiedCreator: true,
      isVerifiedServiceProvider: true,
    },
  });
  if (!profile) return false;
  if (
    profile.isVerified ||
    profile.isVerifiedCreator ||
    profile.isVerifiedServiceProvider
  ) {
    return true;
  }

  try {
    const anyRequest = await prisma.verificationRequest.findFirst({
      where: { profileId },
      select: { id: true },
    });
    return Boolean(anyRequest);
  } catch (error) {
    if (isMissingVerificationSchema(error)) return false;
    throw error;
  }
}

export async function getMyVerificationRequests(profileId: string) {
  try {
    return await prisma.verificationRequest.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (isMissingVerificationSchema(error)) {
      console.warn(
        "Verification requests are unavailable until VerificationRequest migrations are applied.",
      );
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
      console.warn(
        "Admin verification queue is unavailable until VerificationRequest migrations are applied.",
      );
      return [];
    }
    throw error;
  }
}

export type PendingVerificationRequest = Awaited<
  ReturnType<typeof getPendingVerificationRequests>
>[number];

export type ReviewVerificationResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const VERIFICATION_FIELD: Record<
  VerificationRequestType,
  "isVerifiedCreator" | "isVerifiedServiceProvider"
> = {
  creator: "isVerifiedCreator",
  service_provider: "isVerifiedServiceProvider",
};

/**
 * Purges the ID photo and selfie video from Cloudinary and stamps mediaDeletedAt - the
 * privacy policy promises deletion "immediately after manual review," so this runs right
 * after every approve/deny decision. Deliberately swallows failures (logged, not thrown):
 * a Cloudinary hiccup must never leave a verification decision half-applied, and a failed
 * delete here just means the next run (or a manual cleanup) can retry against a still-null
 * mediaDeletedAt.
 */
async function deleteVerificationMedia(request: {
  id: string;
  govIdUrl: string;
  selfieUrl: string;
}): Promise<void> {
  try {
    await Promise.all([
      deleteCloudinaryAsset(request.govIdUrl, "image"),
      deleteCloudinaryAsset(request.selfieUrl, "video"),
    ]);
    await prisma.verificationRequest.update({
      where: { id: request.id },
      data: { mediaDeletedAt: new Date() },
    });
  } catch (error) {
    console.error("[verification] failed to delete media for request", request.id, error);
  }
}

export async function approveVerificationRequest(
  requestId: string,
  reviewerId: string,
): Promise<ReviewVerificationResult> {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    include: { profile: { select: { userId: true, username: true } } },
  });
  if (!request) {
    return { ok: false, status: 404, error: "Request not found" };
  }
  if (request.status !== "pending") {
    return {
      ok: false,
      status: 400,
      error: "Request has already been reviewed",
    };
  }
  if (request.profile.userId === reviewerId) {
    return { ok: false, status: 403, error: "You can't review your own verification request" };
  }

  await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id: requestId },
      data: { status: "approved", reviewerId, reviewedAt: new Date() },
    }),
    prisma.profile.update({
      where: { id: request.profileId },
      data: {
        isVerified: true,
        verificationPending: false,
        [VERIFICATION_FIELD[request.requestType]]: true,
      },
    }),
  ]);

  await deleteVerificationMedia(request);
  await recordAdminAction({
    actorId: reviewerId,
    action: "verification.approve",
    targetType: "profile",
    targetId: request.profileId,
    summary: `Approved ${request.requestType} verification for @${request.profile.username}`,
  });

  return { ok: true };
}

/**
 * Denying a request means the submitted ID/selfie was judged incorrect or
 * fraudulent, so the account is suspended in the same action rather than left
 * to resubmit freely.
 */
export async function denyVerificationRequest(
  requestId: string,
  reviewerId: string,
): Promise<ReviewVerificationResult> {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    include: { profile: { select: { userId: true, username: true } } },
  });
  if (!request) {
    return { ok: false, status: 404, error: "Request not found" };
  }
  if (request.status !== "pending") {
    return {
      ok: false,
      status: 400,
      error: "Request has already been reviewed",
    };
  }
  if (request.profile.userId === reviewerId) {
    return { ok: false, status: 403, error: "You can't review your own verification request" };
  }

  await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id: requestId },
      data: { status: "denied", reviewerId, reviewedAt: new Date() },
    }),
    prisma.profile.update({
      where: { id: request.profileId },
      data: { isSuspended: true, suspendedAt: new Date(), verificationPending: false },
    }),
  ]);

  await deleteVerificationMedia(request);
  await recordAdminAction({
    actorId: reviewerId,
    action: "verification.deny",
    targetType: "profile",
    targetId: request.profileId,
    summary: `Denied ${request.requestType} verification for @${request.profile.username} (account suspended)`,
  });

  return { ok: true };
}
