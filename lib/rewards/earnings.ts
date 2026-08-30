import "server-only";

import { prisma } from "@/lib/prisma";
import type { ProfileType } from "@prisma/client";
import { PREMIUM_SUBSCRIPTION_PRICE_CENTS, countActivePremiumSubscriptionsInRange } from "@/lib/premium";
import { isProviderProfileType } from "@/lib/provider-types";
import { calculatePoints, calculatePointsBreakdown, distributePool, pointWeight, METRIC_TYPES, METRIC_TYPE_LABELS } from "./points";

const REWARDS_POOL_SHARE = 0.7;
const DASHBOARD_MONTH_COUNT = 12;

function currentMonthRange(reference = new Date()): { start: Date; end: Date } {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  return { start, end };
}

function monthRange(offsetFromCurrent: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetFromCurrent, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetFromCurrent + 1, 1);
  return { start, end, key: monthKey(start), label: monthShortLabel(start) };
}

function dashboardMonthBuckets() {
  return Array.from({ length: DASHBOARD_MONTH_COUNT }, (_, index) => monthRange(index - DASHBOARD_MONTH_COUNT + 1));
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthShortLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function monthLongLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sumAmounts(items: { amountCents: number }[]) {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

function subscriptionRevenueWhere(providerId: string, start?: Date, end?: Date) {
  return {
    status: "succeeded",
    ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
    OR: [
      { subscription: { creatorId: providerId } },
      { tier: { creatorId: providerId } },
      { providerSubscription: { providerId } },
    ],
  };
}

function eventRevenueWhere(providerId: string, start?: Date, end?: Date) {
  return {
    status: "succeeded",
    event: { hostId: providerId },
    ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
  };
}

function giftRevenueWhere(providerId: string, start?: Date, end?: Date) {
  return {
    receiverId: providerId,
    ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
  };
}

function sumGiftShares(items: { valueCents: number }[]) {
  return items.reduce((sum, item) => sum + item.valueCents, 0);
}

export async function getProviderEarningsHistory(providerId: string) {
  return prisma.providerEarning.findMany({
    where: { providerId },
    orderBy: { month: "desc" },
    select: {
      id: true,
      month: true,
      points: true,
      amountCents: true,
      status: true,
      payoutReference: true,
      paidAt: true,
      createdAt: true,
    },
  });
}

export type ProviderEarningsHistory = Awaited<ReturnType<typeof getProviderEarningsHistory>>;

/**
 * A live, in-progress estimate of this provider's current-month standing in
 * the rewards pool — recomputed on every read from this month's
 * EngagementMetric rows and premium-subscriber count so far. It will not
 * match the actual payout exactly: that's finalized once the month ends and
 * app/api/cron/monthly-rewards runs, at which point it appears in
 * getProviderEarningsHistory() instead.
 */
export async function getCurrentMonthEstimate(providerId: string, providerType: ProfileType, isMonetized: boolean) {
  const { start, end } = currentMonthRange();

  const [providers, premiumSubscriberCount, ownMetrics] = await Promise.all([
    prisma.profile.findMany({
      where: { isMonetized: true },
      select: { id: true, profileType: true },
    }),
    countActivePremiumSubscriptionsInRange(start, end),
    prisma.engagementMetric.findMany({
      where: { providerId, createdAt: { gte: start, lt: end } },
      select: { metricType: true, value: true },
    }),
  ]);

  const otherProviderIds = providers.filter((provider) => provider.id !== providerId).map((provider) => provider.id);
  const otherMetricSums = await prisma.engagementMetric.groupBy({
    by: ["providerId", "metricType"],
    where: { createdAt: { gte: start, lt: end }, providerId: { in: otherProviderIds } },
    _sum: { value: true },
  });

  const providerTypeById = new Map(providers.map((provider) => [provider.id, provider.profileType]));
  const metricsByProviderId = new Map<string, { metricType: string; value: number }[]>();
  for (const row of otherMetricSums) {
    const list = metricsByProviderId.get(row.providerId) ?? [];
    list.push({ metricType: row.metricType, value: row._sum.value ?? 0 });
    metricsByProviderId.set(row.providerId, list);
  }

  // Own points are always shown (so a not-yet-monetized provider can see what
  // they're accumulating), but only enter the pool cohort — and therefore the
  // payout/percent math below — once isMonetized is true.
  const pointsByProvider = new Map<string, number>();
  const ownPoints = calculatePoints(ownMetrics, providerType);
  if (isMonetized && ownPoints > 0) pointsByProvider.set(providerId, ownPoints);
  for (const [otherId, metrics] of Array.from(metricsByProviderId.entries())) {
    const otherType = providerTypeById.get(otherId);
    if (!otherType) continue;
    const points = calculatePoints(metrics, otherType);
    if (points > 0) pointsByProvider.set(otherId, points);
  }

  const totalRevenueCents = premiumSubscriberCount * PREMIUM_SUBSCRIPTION_PRICE_CENTS;
  const poolCents = Math.round(totalRevenueCents * REWARDS_POOL_SHARE);
  const payouts = distributePool(poolCents, pointsByProvider);
  const totalPoints = Array.from(pointsByProvider.values()).reduce((sum, points) => sum + points, 0);

  return {
    isMonetized,
    premiumSubscriberCount,
    poolCents,
    totalPoints,
    ownPoints,
    ownPointsPercent: isMonetized && totalPoints > 0 ? (ownPoints / totalPoints) * 100 : 0,
    estimatedAmountCents: isMonetized ? (payouts.get(providerId) ?? 0) : 0,
    pointsBreakdown: calculatePointsBreakdown(ownMetrics, providerType),
  };
}

export type ProviderEarningsDashboardData = Awaited<ReturnType<typeof getProviderEarningsDashboard>>;

export async function getProviderEarningsDashboard(providerId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: providerId },
    select: { id: true, profileType: true, isMonetized: true, monetizationStatus: true },
  });
  if (!profile || !isProviderProfileType(profile.profileType)) return null;

  const now = new Date();
  const thisMonth = currentMonthRange(now);
  const lastMonth = monthRange(-1);
  const buckets = dashboardMonthBuckets();
  const firstBucketStart = buckets[0].start;

  const [
    directAll,
    directThisMonth,
    directLastMonth,
    eventAll,
    eventThisMonth,
    eventLastMonth,
    giftAll,
    giftThisMonth,
    giftLastMonth,
    rewardsHistory,
    rewardsEstimate,
    activeLegacySubscribers,
    activeProviderSubscribers,
    legacySubscriptions,
    providerSubscriptions,
    monthlyDirectTransactions,
    monthlyEventTransactions,
    monthlyGifts,
    monthlyMetrics,
    currentMonthMetricSums,
    serviceBookingSignals,
  ] = await Promise.all([
    prisma.transaction.findMany({ where: subscriptionRevenueWhere(providerId), select: { amountCents: true } }),
    prisma.transaction.findMany({
      where: subscriptionRevenueWhere(providerId, thisMonth.start, thisMonth.end),
      select: { amountCents: true },
    }),
    prisma.transaction.findMany({
      where: subscriptionRevenueWhere(providerId, lastMonth.start, lastMonth.end),
      select: { amountCents: true },
    }),
    prisma.transaction.findMany({ where: eventRevenueWhere(providerId), select: { amountCents: true } }),
    prisma.transaction.findMany({
      where: eventRevenueWhere(providerId, thisMonth.start, thisMonth.end),
      select: { amountCents: true },
    }),
    prisma.transaction.findMany({
      where: eventRevenueWhere(providerId, lastMonth.start, lastMonth.end),
      select: { amountCents: true },
    }),
    prisma.gift.findMany({ where: giftRevenueWhere(providerId), select: { valueCents: true } }),
    prisma.gift.findMany({
      where: giftRevenueWhere(providerId, thisMonth.start, thisMonth.end),
      select: { valueCents: true },
    }),
    prisma.gift.findMany({
      where: giftRevenueWhere(providerId, lastMonth.start, lastMonth.end),
      select: { valueCents: true },
    }),
    getProviderEarningsHistory(providerId),
    getCurrentMonthEstimate(providerId, profile.profileType, profile.isMonetized),
    prisma.subscription.count({ where: { creatorId: providerId, status: "active", endsAt: { gt: now } } }),
    prisma.providerSubscription.count({ where: { providerId, status: "active", endsAt: { gt: now } } }),
    prisma.subscription.findMany({ where: { creatorId: providerId }, select: { createdAt: true } }),
    prisma.providerSubscription.findMany({ where: { providerId }, select: { createdAt: true } }),
    prisma.transaction.findMany({
      where: subscriptionRevenueWhere(providerId, firstBucketStart, buckets[buckets.length - 1].end),
      select: { amountCents: true, createdAt: true },
    }),
    prisma.transaction.findMany({
      where: eventRevenueWhere(providerId, firstBucketStart, buckets[buckets.length - 1].end),
      select: { amountCents: true, createdAt: true },
    }),
    prisma.gift.findMany({
      where: giftRevenueWhere(providerId, firstBucketStart, buckets[buckets.length - 1].end),
      select: { valueCents: true, createdAt: true },
    }),
    prisma.engagementMetric.findMany({
      where: { providerId, createdAt: { gte: firstBucketStart, lt: buckets[buckets.length - 1].end } },
      select: { metricType: true, value: true, createdAt: true },
    }),
    prisma.engagementMetric.groupBy({
      by: ["metricType"],
      where: { providerId, createdAt: { gte: thisMonth.start, lt: thisMonth.end } },
      _sum: { value: true },
    }),
    prisma.engagementMetric.count({
      where: { providerId, metricType: METRIC_TYPES.SERVICE_BOOKING },
    }),
  ]);

  const directAllCents = sumAmounts(directAll);
  const directThisMonthCents = sumAmounts(directThisMonth);
  const directLastMonthCents = sumAmounts(directLastMonth);
  const rewardsAllCents = rewardsHistory.reduce((sum, entry) => sum + entry.amountCents, 0);
  const rewardsLastMonthCents = rewardsHistory.find((entry) => entry.month === lastMonth.key)?.amountCents ?? 0;
  const eventAllCents = sumAmounts(eventAll);
  const eventThisMonthCents = sumAmounts(eventThisMonth);
  const eventLastMonthCents = sumAmounts(eventLastMonth);
  const giftAllCents = sumGiftShares(giftAll);
  const giftThisMonthCents = sumGiftShares(giftThisMonth);
  const giftLastMonthCents = sumGiftShares(giftLastMonth);
  const activeSubscribers = activeLegacySubscribers + activeProviderSubscribers;

  const monthly = buckets.map((bucket) => {
    const directCents = monthlyDirectTransactions
      .filter((tx) => tx.createdAt >= bucket.start && tx.createdAt < bucket.end)
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    const rewardCents =
      bucket.key === monthKey(now)
        ? rewardsEstimate.estimatedAmountCents
        : rewardsHistory.find((entry) => entry.month === bucket.key)?.amountCents ?? 0;
    const giftCents = monthlyGifts
      .filter((gift) => gift.createdAt >= bucket.start && gift.createdAt < bucket.end)
      .reduce((sum, gift) => sum + gift.valueCents, 0);
    const eventCents = monthlyEventTransactions
      .filter((tx) => tx.createdAt >= bucket.start && tx.createdAt < bucket.end)
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    const metrics = monthlyMetrics.filter((metric) => metric.createdAt >= bucket.start && metric.createdAt < bucket.end);

    return {
      month: bucket.key,
      label: bucket.label,
      directSubscriptionsCents: directCents,
      rewardsPoolCents: rewardCents,
      serviceBookingsCents: 0,
      tipsCents: giftCents,
      eventTicketsCents: eventCents,
      totalCents: directCents + rewardCents + giftCents + eventCents,
      subscriberCount:
        legacySubscriptions.filter((sub) => sub.createdAt < bucket.end).length +
        providerSubscriptions.filter((sub) => sub.createdAt < bucket.end).length,
      points: calculatePoints(metrics, profile.profileType),
    };
  });

  const currentMetricsByType = new Map(currentMonthMetricSums.map((row) => [row.metricType, row._sum.value ?? 0]));
  const metricRows = [
    METRIC_TYPES.CONTENT_VIEW,
    METRIC_TYPES.MESSAGE_REPLY,
    METRIC_TYPES.PROFILE_VIEW,
    METRIC_TYPES.SUBSCRIBER_RETENTION,
    METRIC_TYPES.EVENT_RSVP,
    METRIC_TYPES.SERVICE_BOOKING,
  ].map((metricType) => {
    const count =
      metricType === METRIC_TYPES.SUBSCRIBER_RETENTION
        ? activeSubscribers
        : currentMetricsByType.get(metricType) ?? 0;
    const weight = pointWeight(metricType, profile.profileType);
    return {
      metricType,
      label: metricType === METRIC_TYPES.SUBSCRIBER_RETENTION ? "Active subscribers" : METRIC_TYPE_LABELS[metricType],
      count,
      weight,
      points: count * weight,
    };
  });

  const sourceBreakdown = [
    {
      key: "direct_subscriptions",
      label: "Direct subscriptions",
      amountCents: directAllCents,
      currentMonthCents: directThisMonthCents,
      status: "active",
    },
    {
      key: "rewards_pool",
      label: "Provider rewards pool",
      amountCents: rewardsAllCents + rewardsEstimate.estimatedAmountCents,
      currentMonthCents: rewardsEstimate.estimatedAmountCents,
      status: profile.isMonetized ? "estimated" : "requires monetization",
    },
    {
      key: "service_bookings",
      label: "Service bookings",
      amountCents: 0,
      currentMonthCents: 0,
      status: `${serviceBookingSignals} booking signals`,
    },
    {
      key: "tips",
      label: "Live stream gifts",
      amountCents: giftAllCents,
      currentMonthCents: giftThisMonthCents,
      status: "active",
    },
    {
      key: "event_tickets",
      label: "Event tickets",
      amountCents: eventAllCents,
      currentMonthCents: eventThisMonthCents,
      status: "future",
    },
  ];

  return {
    provider: profile,
    totals: {
      thisMonthCents: directThisMonthCents + rewardsEstimate.estimatedAmountCents + giftThisMonthCents + eventThisMonthCents,
      lastMonthCents: directLastMonthCents + rewardsLastMonthCents + giftLastMonthCents + eventLastMonthCents,
      allTimeCents: directAllCents + rewardsAllCents + giftAllCents + eventAllCents,
      liveEstimatedCurrentMonthCents:
        directThisMonthCents + rewardsEstimate.estimatedAmountCents + giftThisMonthCents + eventThisMonthCents,
    },
    sourceBreakdown,
    monthly,
    points: {
      rows: metricRows,
      total: metricRows.reduce((sum, row) => sum + row.points, 0),
      activeSubscribers,
    },
    rewardsPool: {
      month: monthLongLabel(monthKey(now)),
      poolCents: rewardsEstimate.poolCents,
      premiumSubscriberCount: rewardsEstimate.premiumSubscriberCount,
      providerPoints: rewardsEstimate.ownPoints,
      totalPoints: rewardsEstimate.totalPoints,
      providerPercent: rewardsEstimate.ownPointsPercent,
      estimatedPayoutCents: rewardsEstimate.estimatedAmountCents,
      isMonetized: rewardsEstimate.isMonetized,
    },
    payoutHistory: rewardsHistory.map((entry) => ({
      id: entry.id,
      month: entry.month,
      label: monthLongLabel(entry.month),
      points: entry.points,
      amountCents: entry.amountCents,
      status: entry.status,
      payoutReference: entry.payoutReference,
      paidAt: entry.paidAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}
