import { prisma } from "@/lib/prisma";

/**
 * Cancel access to the legacy Subscription model (creator tiers bought before
 * ProviderSubscription — see lib/providers.ts — became the one real
 * Paystack-backed subscribe flow for every tier, creator or provider alike).
 * Nothing here creates a Subscription anymore: the checkout functions that
 * used to live in this file created a mock, unauthenticated-by-payment
 * Transaction that a "Simulate Payment Success" button (or the mock
 * checkout page's own 4-second auto-succeed timer) could resolve for free,
 * with no real charge ever happening. They were removed together with the
 * mock checkout route and page. Reading subscriptions across both the legacy
 * table and ProviderSubscription now goes through getMySubscriptions in
 * lib/subscription-access.ts instead of this file.
 */

export type CancelResult =
  | { ok: true; subscription: Awaited<ReturnType<typeof prisma.subscription.update>> }
  | { ok: false; error: string };

export async function cancelSubscription(subscriptionId: string): Promise<CancelResult> {
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) {
    return { ok: false, error: "Subscription not found" };
  }

  if (subscription.status !== "active") {
    return { ok: true, subscription };
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "cancelled" },
  });

  return { ok: true, subscription: updated };
}
