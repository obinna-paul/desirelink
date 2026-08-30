import { prisma } from "@/lib/prisma";

/**
 * Read/cancel access to the legacy Subscription model (creator tiers bought
 * before ProviderSubscription — see lib/providers.ts — became the one real
 * Paystack-backed subscribe flow for every tier, creator or provider alike).
 * Nothing here creates a Subscription anymore: the checkout functions that
 * used to live in this file created a mock, unauthenticated-by-payment
 * Transaction that a "Simulate Payment Success" button (or the mock
 * checkout page's own 4-second auto-succeed timer) could resolve for free,
 * with no real charge ever happening. They were removed together with the
 * mock checkout route and page.
 */

export async function getMySubscriptions(subscriberId: string) {
  return prisma.subscription.findMany({
    where: { subscriberId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      tier: { select: { name: true, priceCents: true } },
      creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
}

export type MySubscription = Awaited<ReturnType<typeof getMySubscriptions>>[number];

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
