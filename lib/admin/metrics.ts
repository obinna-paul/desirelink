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
