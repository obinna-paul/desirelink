import "server-only";

import { prisma } from "@/lib/prisma";

export async function getQueueCounts() {
  const [verification, moderation, withdrawal] = await Promise.all([
    prisma.verificationRequest.count({ where: { status: "pending" } }),
    prisma.moderationQueue.count({ where: { status: "pending" } }),
    prisma.walletWithdrawal.count({ where: { status: "pending" } }),
  ]);
  return { verification, moderation, withdrawal, total: verification + moderation + withdrawal };
}

/** Cheap, direct-query snapshot for the landing dashboard - fine at today's scale. The
 * plan flags precomputed nightly rollups as a later scaling step if this ever gets slow. */
export async function getOverviewSnapshot() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [signups24h, newCreators24h, revenue24h, heartsPurchased24h, suspensions7d, paidPayouts30d, failedPayouts30d, failedCharges7d] =
    await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.profile.count({ where: { profileType: "CREATOR", createdAt: { gte: dayAgo } } }),
      prisma.transaction.aggregate({ where: { status: "succeeded", createdAt: { gte: dayAgo } }, _sum: { amountCents: true } }),
      prisma.heartPurchase.aggregate({ where: { status: "succeeded", createdAt: { gte: dayAgo } }, _sum: { hearts: true } }),
      prisma.profile.count({ where: { isSuspended: true, suspendedAt: { gte: weekAgo } } }),
      prisma.walletWithdrawal.count({ where: { status: "paid", paidAt: { gte: monthAgo } } }),
      prisma.walletWithdrawal.count({ where: { status: "failed", createdAt: { gte: monthAgo } } }),
      prisma.transaction.count({ where: { status: "failed", createdAt: { gte: weekAgo } } }),
    ]);

  const totalPayouts30d = paidPayouts30d + failedPayouts30d;

  return {
    signups24h,
    newCreators24h,
    revenue24hCents: revenue24h._sum.amountCents ?? 0,
    heartsPurchased24h: heartsPurchased24h._sum.hearts ?? 0,
    suspensions7d,
    payoutSuccessRate: totalPayouts30d > 0 ? Math.round((paidPayouts30d / totalPayouts30d) * 100) : null,
    failedCharges7d,
  };
}

export const INSIGHTS_RANGES = ["7d", "30d", "90d", "12mo"] as const;
export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

const RANGE_DAYS: Record<InsightsRange, number> = { "7d": 7, "30d": 30, "90d": 90, "12mo": 365 };
const BUCKET_DAYS: Record<InsightsRange, number> = { "7d": 1, "30d": 1, "90d": 7, "12mo": 30 };

function bucketLabel(date: Date, range: InsightsRange) {
  return range === "12mo"
    ? date.toLocaleDateString(undefined, { month: "short" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildBuckets(range: InsightsRange) {
  const bucketDays = BUCKET_DAYS[range];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - RANGE_DAYS[range]);

  const buckets: { start: Date; end: Date; label: string }[] = [];
  let cursor = new Date(rangeStart);
  while (cursor < now) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + bucketDays);
    buckets.push({ start, end: end > now ? now : end, label: bucketLabel(start, range) });
    cursor = end;
  }
  return { buckets, rangeStart, now };
}

/** Revenue split by source, bucketed for a trend chart. A Transaction is classified by
 * which foreign key is set: subscriptionId/providerSubscriptionId -> subscriptions,
 * serviceBookingId -> services, neither -> hearts (the only other flow that creates a
 * Transaction row - see purchaseHearts in lib/hearts.ts). */
export async function getRevenueTrend(range: InsightsRange) {
  const { buckets, rangeStart } = buildBuckets(range);

  const transactions = await prisma.transaction.findMany({
    where: { status: "succeeded", createdAt: { gte: rangeStart } },
    select: { createdAt: true, amountCents: true, subscriptionId: true, providerSubscriptionId: true, serviceBookingId: true },
  });

  return buckets.map((bucket) => {
    const inBucket = transactions.filter((t) => t.createdAt >= bucket.start && t.createdAt < bucket.end);
    const subscriptions = inBucket.filter((t) => t.subscriptionId || t.providerSubscriptionId).reduce((sum, t) => sum + t.amountCents, 0);
    const services = inBucket.filter((t) => t.serviceBookingId).reduce((sum, t) => sum + t.amountCents, 0);
    const hearts = inBucket
      .filter((t) => !t.subscriptionId && !t.providerSubscriptionId && !t.serviceBookingId)
      .reduce((sum, t) => sum + t.amountCents, 0);

    return {
      label: bucket.label,
      subscriptions: Math.round(subscriptions) / 100,
      services: Math.round(services) / 100,
      hearts: Math.round(hearts) / 100,
    };
  });
}

export async function getGrowthSummary(range: InsightsRange) {
  const { rangeStart } = buildBuckets(range);

  const [signups, newCreators, activeUsers, payingProfiles] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: rangeStart } } }),
    prisma.profile.count({ where: { profileType: "CREATOR", createdAt: { gte: rangeStart } } }),
    prisma.profile.count({ where: { lastActiveAt: { gte: rangeStart } } }),
    prisma.transaction.findMany({
      where: { status: "succeeded", createdAt: { gte: rangeStart } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  return { signups, newCreators, activeUsers, payingUsers: payingProfiles.length };
}

/** A rough activation funnel from the fields the schema actually has - "everEarned" checks
 * current wallet balance > 0, which understates creators who've since withdrawn
 * everything. Good enough to see the shape of the drop-off, not a precise cohort count. */
export async function getActivationFunnel() {
  const [totalSignups, switchedToCreator, creatorsWithPost, creatorsEverEarned] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count({ where: { profileType: "CREATOR" } }),
    prisma.post.findMany({ where: { author: { profileType: "CREATOR" } }, select: { authorId: true }, distinct: ["authorId"] }),
    prisma.profile.count({ where: { profileType: "CREATOR", walletBalanceCents: { gt: 0 } } }),
  ]);

  return {
    totalSignups,
    switchedToCreator,
    postedAsCreator: creatorsWithPost.length,
    everEarned: creatorsEverEarned,
  };
}
