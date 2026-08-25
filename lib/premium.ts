import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Udala Premium doesn't have a checkout flow built yet (schema-only, from the
 * phase-A monetization migration) — there's nowhere in the product for a user
 * to actually buy it. Until that exists, this fixed price is what the rewards
 * pool math below treats every active PremiumSubscription as worth; swap this
 * for real Stripe invoice totals once premium checkout ships.
 */
export const PREMIUM_SUBSCRIPTION_PRICE_CENTS = 1999;

export async function isPremiumUser(profileId: string): Promise<boolean> {
  const premium = await prisma.premiumSubscription.findUnique({
    where: { userId: profileId },
    select: { status: true, currentPeriodEnd: true },
  });
  return Boolean(premium && premium.status === "active" && premium.currentPeriodEnd > new Date());
}

/** Count of premium subscriptions active at any point during [start, end). */
export async function countActivePremiumSubscriptionsInRange(start: Date, end: Date): Promise<number> {
  return prisma.premiumSubscription.count({
    where: {
      status: { in: ["active", "cancelled"] },
      currentPeriodStart: { lt: end },
      currentPeriodEnd: { gt: start },
    },
  });
}
