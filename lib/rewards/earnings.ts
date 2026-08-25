import "server-only";

import { prisma } from "@/lib/prisma";
import type { ProfileType } from "@prisma/client";
import { PREMIUM_SUBSCRIPTION_PRICE_CENTS, countActivePremiumSubscriptionsInRange } from "@/lib/premium";
import { calculatePoints, calculatePointsBreakdown, distributePool } from "./points";
import { PROVIDER_PROFILE_TYPES } from "@/lib/provider-types";

const REWARDS_POOL_SHARE = 0.7;

function currentMonthRange(reference = new Date()): { start: Date; end: Date } {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  return { start, end };
}

export async function getProviderEarningsHistory(providerId: string) {
  return prisma.providerEarning.findMany({
    where: { providerId },
    orderBy: { month: "desc" },
    select: { id: true, month: true, points: true, amountCents: true, status: true, createdAt: true },
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
      where: { profileType: { in: [...PROVIDER_PROFILE_TYPES] }, isMonetized: true },
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
    poolCents,
    totalPoints,
    ownPoints,
    ownPointsPercent: isMonetized && totalPoints > 0 ? (ownPoints / totalPoints) * 100 : 0,
    estimatedAmountCents: isMonetized ? (payouts.get(providerId) ?? 0) : 0,
    pointsBreakdown: calculatePointsBreakdown(ownMetrics, providerType),
  };
}
