import "server-only";

import { prisma } from "@/lib/prisma";
import { buildMetricBuckets, getAdminTransactionSource } from "@/lib/admin/metric-helpers";

export { INSIGHTS_RANGES, type InsightsRange } from "@/lib/admin/metric-helpers";
import type { InsightsRange } from "@/lib/admin/metric-helpers";

export type AdminQueueScope = {
  verification: boolean;
  moderation: boolean;
  withdrawal: boolean;
  support: boolean;
};

export async function getQueueCounts(scope: AdminQueueScope) {
  const [verification, moderation, withdrawal, support] = await Promise.all([
    scope.verification ? prisma.verificationRequest.count({ where: { status: "pending" } }) : 0,
    scope.moderation ? prisma.moderationQueue.count({ where: { status: "pending" } }) : 0,
    scope.withdrawal ? prisma.walletWithdrawal.count({ where: { status: "pending" } }) : 0,
    scope.support ? prisma.supportTicket.count({ where: { status: "open" } }) : 0,
  ]);
  return {
    verification,
    moderation,
    withdrawal,
    support,
    total: verification + moderation + withdrawal + support,
  };
}

async function getPublishingProfileIdsSince(since?: Date) {
  const createdAt = since ? { gte: since } : undefined;
  const [posts, services, rooms, liveStreams] = await Promise.all([
    prisma.post.findMany({
      where: { isArchived: false, createdAt },
      select: { authorId: true },
      distinct: ["authorId"],
    }),
    prisma.serviceListing.findMany({
      where: { createdAt },
      select: { providerId: true },
      distinct: ["providerId"],
    }),
    prisma.circle.findMany({
      where: { createdAt },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.liveStream.findMany({
      where: { createdAt },
      select: { providerId: true },
      distinct: ["providerId"],
    }),
  ]);

  return new Set([
    ...posts.map((item) => item.authorId),
    ...services.map((item) => item.providerId),
    ...rooms.map((item) => item.userId),
    ...liveStreams.map((item) => item.providerId),
  ]);
}

/** Cheap, direct-query snapshot for the landing dashboard - fine at today's scale. The
 * plan flags precomputed nightly rollups as a later scaling step if this ever gets slow. */
export async function getOverviewSnapshot() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [signups24h, publishingProfiles24h, grossPayments24h, heartsPurchased24h, suspensions7d, paidPayouts30d, failedPayouts30d, failedCharges7d] =
    await Promise.all([
      prisma.profile.count({ where: { createdAt: { gte: dayAgo } } }),
      getPublishingProfileIdsSince(dayAgo),
      prisma.transaction.aggregate({ where: { status: "succeeded", createdAt: { gte: dayAgo } }, _sum: { amountCents: true } }),
      prisma.heartPurchase.aggregate({ where: { status: "succeeded", createdAt: { gte: dayAgo } }, _sum: { hearts: true } }),
      prisma.profile.count({ where: { isSuspended: true, suspendedAt: { gte: weekAgo } } }),
      prisma.walletWithdrawal.count({ where: { status: "paid", createdAt: { gte: monthAgo } } }),
      prisma.walletWithdrawal.count({ where: { status: "failed", createdAt: { gte: monthAgo } } }),
      prisma.transaction.count({ where: { status: "failed", createdAt: { gte: weekAgo } } }),
    ]);

  const totalPayouts30d = paidPayouts30d + failedPayouts30d;

  return {
    signups24h,
    publishingProfiles24h: publishingProfiles24h.size,
    grossPayments24hCents: grossPayments24h._sum.amountCents ?? 0,
    heartsPurchased24h: heartsPurchased24h._sum.hearts ?? 0,
    suspensions7d,
    payoutSuccessRate: totalPayouts30d > 0 ? Math.round((paidPayouts30d / totalPayouts30d) * 100) : null,
    failedCharges7d,
  };
}

/** Revenue split by source, bucketed for a trend chart. A Transaction is classified by
 * which foreign key is set: subscriptionId/providerSubscriptionId/tierId -> subscriptions,
 * serviceBookingId -> services, neither -> hearts (the only other flow that creates a
 * Transaction row - see purchaseHearts in lib/hearts.ts). */
export async function getRevenueTrend(range: InsightsRange) {
  const { buckets, rangeStart } = buildMetricBuckets(range);

  const transactions = await prisma.transaction.findMany({
    where: { status: "succeeded", createdAt: { gte: rangeStart } },
    select: { createdAt: true, amountCents: true, subscriptionId: true, providerSubscriptionId: true, tierId: true, serviceBookingId: true },
  });

  return buckets.map((bucket) => {
    const inBucket = transactions.filter((t) => t.createdAt >= bucket.start && t.createdAt < bucket.end);
    const subscriptions = inBucket.filter((t) => getAdminTransactionSource(t) === "Subscription").reduce((sum, t) => sum + t.amountCents, 0);
    const services = inBucket.filter((t) => getAdminTransactionSource(t) === "Service booking").reduce((sum, t) => sum + t.amountCents, 0);
    const hearts = inBucket
      .filter((t) => getAdminTransactionSource(t) === "Hearts purchase")
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
  const { rangeStart } = buildMetricBuckets(range);

  const [signups, publishingProfiles, activeUsers, payingProfiles] = await Promise.all([
    prisma.profile.count({ where: { createdAt: { gte: rangeStart } } }),
    getPublishingProfileIdsSince(rangeStart),
    prisma.profile.count({ where: { lastActiveAt: { gte: rangeStart } } }),
    prisma.transaction.findMany({
      where: { status: "succeeded", createdAt: { gte: rangeStart } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  return { signups, publishingProfiles: publishingProfiles.size, activeUsers, payingUsers: payingProfiles.length };
}

/** Independent, all-time account milestones. These are deliberately not presented as a
 * funnel: people can earn from services or gifts without first publishing a feed post. */
export async function getAccountMilestones() {
  const [totalProfiles, publishers, postAuthors, serviceProviders, fundedWallets, withdrawals, giftReceivers, completedLiveRequests, paidTransactions] =
    await Promise.all([
      prisma.profile.count(),
      getPublishingProfileIdsSince(),
      prisma.post.findMany({ where: { isArchived: false }, select: { authorId: true }, distinct: ["authorId"] }),
      prisma.serviceListing.findMany({ select: { providerId: true }, distinct: ["providerId"] }),
      prisma.profile.findMany({ where: { walletBalanceCents: { gt: 0 } }, select: { id: true } }),
      prisma.walletWithdrawal.findMany({ select: { providerId: true }, distinct: ["providerId"] }),
      prisma.gift.findMany({ select: { receiverId: true }, distinct: ["receiverId"] }),
      prisma.liveRequest.findMany({ where: { status: "completed" }, select: { providerId: true }, distinct: ["providerId"] }),
      prisma.transaction.findMany({
        where: { status: "succeeded" },
        select: {
          escrowStatus: true,
          subscription: { select: { creatorId: true } },
          providerSubscription: { select: { providerId: true } },
          tier: { select: { creatorId: true } },
          serviceBooking: { select: { providerId: true } },
        },
      }),
    ]);

  const earningProfileIds = new Set([
    ...fundedWallets.map((item) => item.id),
    ...withdrawals.map((item) => item.providerId),
    ...giftReceivers.map((item) => item.receiverId),
    ...completedLiveRequests.map((item) => item.providerId),
  ]);
  paidTransactions.forEach((transaction) => {
    if (transaction.subscription?.creatorId) earningProfileIds.add(transaction.subscription.creatorId);
    if (transaction.providerSubscription?.providerId) earningProfileIds.add(transaction.providerSubscription.providerId);
    if (transaction.tier?.creatorId) earningProfileIds.add(transaction.tier.creatorId);
    if (transaction.escrowStatus === "released" && transaction.serviceBooking?.providerId) {
      earningProfileIds.add(transaction.serviceBooking.providerId);
    }
  });

  return {
    totalProfiles,
    publishingProfiles: publishers.size,
    profilesWithPosts: postAuthors.length,
    profilesWithServices: serviceProviders.length,
    earningProfiles: earningProfileIds.size,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Standard Gini coefficient over a sorted-ascending array of nonnegative values - 0 is a
 * perfectly equal distribution, close to 1 means impressions are concentrated in a
 * handful of creators. */
function giniCoefficient(sortedAscending: number[]): number {
  const n = sortedAscending.length;
  if (n === 0) return 0;
  const total = sortedAscending.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;

  let cumulative = 0;
  let weightedSum = 0;
  for (const value of sortedAscending) {
    cumulative += value;
    weightedSum += cumulative;
  }
  return (n + 1 - (2 * weightedSum) / total) / n;
}

/** Share of the total held by the top `fraction` of entries (e.g. 0.01 for the top 1%),
 * from a sorted-ascending array. */
function topShare(sortedAscending: number[], fraction: number): number {
  const n = sortedAscending.length;
  if (n === 0) return 0;
  const total = sortedAscending.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;

  const topCount = Math.max(1, Math.round(n * fraction));
  const topSum = sortedAscending.slice(n - topCount).reduce((sum, value) => sum + value, 0);
  return (topSum / total) * 100;
}

export type DiscoveryGuardrails = {
  reportRatePer1000Impressions: number;
  newCreatorReachPct: number;
  repeatContentRatePct: number;
  creatorReachGini: number;
  top1PercentCreatorImpressionSharePct: number;
  activeViewers: number;
};

/**
 * Guardrails for the discovery/ranking plan's Metrics section - watched alongside growth,
 * never optimized for directly (see the plan: no A/B-testing framework yet at this
 * traffic, this dashboard plus a holdout group is the intended substitute).
 *
 * repeatContentRatePct reads raw PostImpression rows, which are only retained ~45 days
 * (see lib/post-daily-stats.ts's pruneOldPostImpressions). For a 90d/12mo range it
 * reflects only whatever raw impressions still exist, not the full period. Everything
 * else reads PostDailyStats, which is kept indefinitely.
 */
export async function getDiscoveryGuardrails(range: InsightsRange): Promise<DiscoveryGuardrails> {
  const { rangeStart } = buildMetricBuckets(range);

  const [reportsInRange, dailyStatsInRange, impressionsWithAuthor, newCreatorProfiles] =
    await Promise.all([
      prisma.report.count({ where: { targetType: "post", createdAt: { gte: rangeStart } } }),
      prisma.postDailyStats.findMany({
        where: { date: { gte: rangeStart } },
        select: { impressions: true, post: { select: { authorId: true } } },
      }),
      prisma.postImpression.findMany({
        where: { createdAt: { gte: rangeStart } },
        select: { viewerId: true, post: { select: { authorId: true } } },
      }),
      prisma.profile.findMany({ where: { createdAt: { gte: rangeStart } }, select: { id: true } }),
    ]);

  const totalImpressions = dailyStatsInRange.reduce((sum, row) => sum + row.impressions, 0);
  const reportRatePer1000Impressions = totalImpressions > 0 ? (reportsInRange / totalImpressions) * 1000 : 0;

  const newCreatorIds = new Set(newCreatorProfiles.map((profile) => profile.id));
  const newCreatorImpressions = dailyStatsInRange
    .filter((row) => newCreatorIds.has(row.post.authorId))
    .reduce((sum, row) => sum + row.impressions, 0);
  const newCreatorReachPct = totalImpressions > 0 ? (newCreatorImpressions / totalImpressions) * 100 : 0;

  const impressionsByCreator = new Map<string, number>();
  for (const row of dailyStatsInRange) {
    impressionsByCreator.set(row.post.authorId, (impressionsByCreator.get(row.post.authorId) ?? 0) + row.impressions);
  }
  const creatorTotalsAscending = Array.from(impressionsByCreator.values()).sort((a, b) => a - b);
  const creatorReachGini = giniCoefficient(creatorTotalsAscending);
  const top1PercentCreatorImpressionSharePct = topShare(creatorTotalsAscending, 0.01);

  const viewerCreatorPairCounts = new Map<string, number>();
  for (const impression of impressionsWithAuthor) {
    const key = `${impression.viewerId}:${impression.post.authorId}`;
    viewerCreatorPairCounts.set(key, (viewerCreatorPairCounts.get(key) ?? 0) + 1);
  }
  const repeatImpressions = Array.from(viewerCreatorPairCounts.values())
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count, 0);
  const repeatContentRatePct =
    impressionsWithAuthor.length > 0 ? (repeatImpressions / impressionsWithAuthor.length) * 100 : 0;

  const activeViewerIds = new Set(impressionsWithAuthor.map((impression) => impression.viewerId));

  return {
    reportRatePer1000Impressions: round2(reportRatePer1000Impressions),
    newCreatorReachPct: round2(newCreatorReachPct),
    repeatContentRatePct: round2(repeatContentRatePct),
    creatorReachGini: round2(creatorReachGini),
    top1PercentCreatorImpressionSharePct: round2(top1PercentCreatorImpressionSharePct),
    activeViewers: activeViewerIds.size,
  };
}
