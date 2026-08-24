import { prisma } from "@/lib/prisma";

/**
 * Weights are tuned so a brand-new, unverified account starts near 0 and a
 * long-tenured, verified member with a clean record and good reviews can
 * approach 100. There's no scheduled job re-running this over time — it's
 * recalculated whenever something that feeds it changes (a review, a report,
 * or a profile save), which is enough for a "simple" system as scoped: the
 * account-age component just won't tick up between those triggers.
 */
const MAX_ACCOUNT_AGE_POINTS = 24; // +1 per 30 days, capped at ~2 years
const EMAIL_VERIFIED_POINTS = 15;
const IDENTITY_VERIFIED_POINTS = 10;
const POSITIVE_REVIEW_POINTS = 5;
const POSITIVE_REVIEW_RATING_THRESHOLD = 4; // rating >= 4 (out of 5) counts as positive

/**
 * Report.status only has three values and this app has no moderation
 * dashboard to ever move a report off "pending" — so in practice only the
 * pending weight is exercised today. "reviewed" and "resolved" are weighted
 * heavier on the assumption that a report a moderator has looked at (and
 * doubly so once resolved) is more likely to be substantiated than a fresh,
 * unverified one — but that path isn't reachable in this app yet.
 */
const PENDING_REPORT_PENALTY = 2;
const REVIEWED_REPORT_PENALTY = 5;
const RESOLVED_REPORT_PENALTY = 10;
const TRUSTED_MEMBER_THRESHOLD = 70;

export type ReputationBreakdown = {
  score: number;
  accountAgePoints: number;
  emailVerifiedPoints: number;
  identityVerifiedPoints: number;
  positiveReviewPoints: number;
  reportPenalty: number;
  positiveReviewCount: number;
  totalReviewCount: number;
  pendingReportCount: number;
  reviewedReportCount: number;
  resolvedReportCount: number;
  isTrustedMember: boolean;
};

export async function calculateReputation(profileId: string): Promise<ReputationBreakdown> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { createdAt: true, isVerified: true, user: { select: { emailVerified: true } } },
  });
  if (!profile) {
    throw new Error("Profile not found");
  }

  const [reviews, reportsByStatus] = await Promise.all([
    prisma.review.findMany({ where: { revieweeId: profileId }, select: { rating: true } }),
    prisma.report.groupBy({
      by: ["status"],
      where: { reportedUserId: profileId },
      _count: { _all: true },
    }),
  ]);

  const ageDays = Math.max(0, (Date.now() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const accountAgePoints = Math.min(MAX_ACCOUNT_AGE_POINTS, Math.floor(ageDays / 30));

  const emailVerifiedPoints = profile.user.emailVerified ? EMAIL_VERIFIED_POINTS : 0;
  const identityVerifiedPoints = profile.isVerified ? IDENTITY_VERIFIED_POINTS : 0;

  const positiveReviewCount = reviews.filter(
    (review) => review.rating >= POSITIVE_REVIEW_RATING_THRESHOLD
  ).length;
  const positiveReviewPoints = positiveReviewCount * POSITIVE_REVIEW_POINTS;

  const pendingReportCount = reportsByStatus.find((r) => r.status === "pending")?._count._all ?? 0;
  const reviewedReportCount = reportsByStatus.find((r) => r.status === "reviewed")?._count._all ?? 0;
  const resolvedReportCount = reportsByStatus.find((r) => r.status === "resolved")?._count._all ?? 0;
  const reportPenalty =
    pendingReportCount * PENDING_REPORT_PENALTY +
    reviewedReportCount * REVIEWED_REPORT_PENALTY +
    resolvedReportCount * RESOLVED_REPORT_PENALTY;

  const rawScore =
    accountAgePoints + emailVerifiedPoints + identityVerifiedPoints + positiveReviewPoints - reportPenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const isTrustedMember = score >= TRUSTED_MEMBER_THRESHOLD && resolvedReportCount === 0;

  return {
    score,
    accountAgePoints,
    emailVerifiedPoints,
    identityVerifiedPoints,
    positiveReviewPoints,
    reportPenalty,
    positiveReviewCount,
    totalReviewCount: reviews.length,
    pendingReportCount,
    reviewedReportCount,
    resolvedReportCount,
    isTrustedMember,
  };
}

/** Recomputes and persists communityStanding + isTrustedMember. Call after anything that feeds the score changes. */
export async function recalculateReputation(profileId: string): Promise<ReputationBreakdown> {
  const breakdown = await calculateReputation(profileId);

  await prisma.profile.update({
    where: { id: profileId },
    data: { communityStanding: breakdown.score, isTrustedMember: breakdown.isTrustedMember },
  });

  return breakdown;
}
