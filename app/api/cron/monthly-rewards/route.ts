import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { PROVIDER_PROFILE_TYPES } from "@/lib/provider-types";
import { countActivePremiumSubscriptionsInRange, PREMIUM_SUBSCRIPTION_PRICE_CENTS } from "@/lib/premium";
import { calculatePoints, distributePool } from "@/lib/rewards/points";
import { recordMonthStartRetentionSnapshot } from "@/lib/rewards/tracking";
import { isCronAuthorized } from "@/lib/security/cron";
import { creditProviderWallet } from "@/lib/wallet";

const REWARDS_POOL_SHARE = 0.7;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthRange(reference: Date): { start: Date; end: Date; month: string } {
  const start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const end = new Date(reference.getFullYear(), reference.getMonth(), 1);
  return { start, end, month: monthKey(start) };
}

/**
 * Placeholder for the earnings-summary email. No transactional email provider
 * is wired up yet (see notifyPaymentFailed in lib/payments/webhook-handler.ts
 * for the same gap) — swap this for a real send once one exists.
 */
async function notifyProviderEarnings(
  providerId: string,
  month: string,
  amountCents: number,
  points: number
): Promise<void> {
  console.warn(
    `[rewards] Provider ${providerId} earned $${(amountCents / 100).toFixed(2)} (${points} points) for ${month} — email notification not yet wired up.`
  );
}

/**
 * Meant to run on the 1st of each month (see vercel.json). Each run:
 * 1. Snapshots subscriber-retention points for the month that just started
 *    (credited toward next month's payout — see recordMonthStartRetentionSnapshot).
 * 2. Calculates and pays out the pool for the month that just ended, from
 *    EngagementMetric rows accumulated during it (including the retention
 *    snapshot recorded on its own 1st).
 *
 * Only providers with isMonetized (see lib/monetization.ts) are eligible —
 * a non-monetized provider's engagement still gets tracked but never enters
 * the points/payout math below. This doesn't touch a provider's own Fan
 * revenue (ProviderSubscription/Subscription), which is unaffected either way.
 */
async function runMonthlyRewards() {
  await recordMonthStartRetentionSnapshot();

  const { start, end, month } = previousMonthRange(new Date());

  const [premiumSubscriberCount, providers] = await Promise.all([
    countActivePremiumSubscriptionsInRange(start, end),
    prisma.profile.findMany({
      where: { profileType: { in: [...PROVIDER_PROFILE_TYPES] }, isMonetized: true },
      select: { id: true, profileType: true },
    }),
  ]);

  const totalRevenueCents = premiumSubscriberCount * PREMIUM_SUBSCRIPTION_PRICE_CENTS;
  const poolCents = Math.round(totalRevenueCents * REWARDS_POOL_SHARE);

  const metricSums = await prisma.engagementMetric.groupBy({
    by: ["providerId", "metricType"],
    where: { createdAt: { gte: start, lt: end }, providerId: { in: providers.map((provider) => provider.id) } },
    _sum: { value: true },
  });

  const metricsByProviderId = new Map<string, { metricType: string; value: number }[]>();
  for (const row of metricSums) {
    const list = metricsByProviderId.get(row.providerId) ?? [];
    list.push({ metricType: row.metricType, value: row._sum.value ?? 0 });
    metricsByProviderId.set(row.providerId, list);
  }

  const pointsByProvider = new Map<string, number>();
  for (const provider of providers) {
    const points = calculatePoints(metricsByProviderId.get(provider.id) ?? [], provider.profileType);
    if (points > 0) pointsByProvider.set(provider.id, points);
  }

  const payouts = distributePool(poolCents, pointsByProvider);

  const earnings = await Promise.all(
    Array.from(payouts.entries()).map(async ([providerId, amountCents]) => {
      const points = pointsByProvider.get(providerId) ?? 0;

      // Never double-credit: once a month's pool share has been credited to
      // the wallet, a re-run of this cron for the same month must be a no-op.
      const existing = await prisma.providerEarning.findUnique({ where: { providerId_month: { providerId, month } } });
      if (existing?.status === "credited") return existing;

      const earning = await prisma.providerEarning.upsert({
        where: { providerId_month: { providerId, month } },
        create: { providerId, month, points, amountCents, status: "credited" },
        update: { points, amountCents, status: "credited" },
      });
      await creditProviderWallet(providerId, amountCents);
      await notifyProviderEarnings(providerId, month, amountCents, points);
      return earning;
    })
  );

  return { month, totalRevenueCents, poolCents, providersPaid: earnings.length };
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runMonthlyRewards();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
