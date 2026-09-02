import { prisma } from "@/lib/prisma";
import { queueModerationFlag } from "@/lib/moderation";
import { recalculateReputation } from "@/lib/reputation";

export const REPORT_TARGET_TYPES = ["profile", "message", "post", "post_comment"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export function isReportTargetType(value: unknown): value is ReportTargetType {
  return typeof value === "string" && (REPORT_TARGET_TYPES as readonly string[]).includes(value);
}

export const REPORT_REASONS = [
  "Harassment or abuse",
  "Spam or scam",
  "Fake profile or impersonation",
  "Underage user",
  "Non-consensual content",
  "Illegal activity",
  "Other",
] as const;

const MAX_DETAILS_LENGTH = 2000;

/** Who a report is ultimately "about" — the profile behind the reported content. */
async function resolveReportedUserId(targetType: ReportTargetType, targetId: string): Promise<string | null> {
  switch (targetType) {
    case "profile": {
      const profile = await prisma.profile.findUnique({ where: { id: targetId }, select: { id: true } });
      return profile?.id ?? null;
    }
    case "message": {
      const message = await prisma.message.findUnique({ where: { id: targetId }, select: { senderId: true } });
      return message?.senderId ?? null;
    }
    case "post": {
      const post = await prisma.post.findUnique({ where: { id: targetId }, select: { authorId: true } });
      return post?.authorId ?? null;
    }
    case "post_comment": {
      const comment = await prisma.postComment.findUnique({ where: { id: targetId }, select: { authorId: true } });
      return comment?.authorId ?? null;
    }
  }
}

export type SubmitReportResult =
  | { ok: true; reportId: string }
  | { ok: false; status: number; error: string };

export async function submitReport(
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
  details: string
): Promise<SubmitReportResult> {
  const trimmedReason = reason.trim();
  const trimmedDetails = details.trim();

  if (!trimmedReason) {
    return { ok: false, status: 400, error: "Select a reason" };
  }
  if (trimmedDetails.length > MAX_DETAILS_LENGTH) {
    return { ok: false, status: 400, error: `Details must be under ${MAX_DETAILS_LENGTH} characters` };
  }

  const reportedUserId = await resolveReportedUserId(targetType, targetId);
  if (!reportedUserId) {
    return { ok: false, status: 404, error: "That content couldn't be found" };
  }
  if (reportedUserId === reporterId) {
    return { ok: false, status: 400, error: "You can't report your own content" };
  }

  const report = await prisma.report.create({
    data: {
      reporterId,
      reportedUserId,
      targetType,
      targetId,
      reason: trimmedReason,
      details: trimmedDetails,
      status: "pending",
    },
  });

  await recalculateReputation(reportedUserId);
  await queueModerationFlag({
    contentType: targetType,
    contentId: targetId,
    contentOwnerId: reportedUserId,
    reporterId,
    reason: `User report: ${trimmedReason}`,
    details: trimmedDetails || "No additional details provided.",
  });

  return { ok: true, reportId: report.id };
}

const reportedUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export async function getMyReports(reporterId: string) {
  return prisma.report.findMany({
    where: { reporterId },
    orderBy: { createdAt: "desc" },
    include: { reportedUser: { select: reportedUserSelect } },
  });
}

export type MyReportData = Awaited<ReturnType<typeof getMyReports>>[number];
