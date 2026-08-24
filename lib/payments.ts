import { prisma } from "@/lib/prisma";

const SUBSCRIPTION_LENGTH_MONTHS = 1;

export type CheckoutResult =
  | { ok: true; checkoutUrl: string; transactionId: string }
  | { ok: false; status: number; error: string };

/**
 * Creates a mock checkout session for a user paying for a creator tier.
 * Re-validates eligibility server-side (never trust a client-supplied price
 * or tier state) and records a pending Transaction — the checkout page then
 * drives that transaction to success/failure via handleWebhook.
 */
export async function createCheckoutSession(userId: string, tierId: string): Promise<CheckoutResult> {
  const tier = await prisma.creatorTier.findUnique({ where: { id: tierId } });
  if (!tier) {
    return { ok: false, status: 404, error: "Tier not found" };
  }

  if (tier.creatorId === userId) {
    return { ok: false, status: 400, error: "You can't subscribe to your own tier" };
  }

  const existingSubscription = await prisma.subscription.findFirst({
    where: { subscriberId: userId, tierId, status: "active", endsAt: { gt: new Date() } },
    select: { id: true },
  });
  if (existingSubscription) {
    return { ok: false, status: 400, error: "You're already subscribed to this tier" };
  }

  if (tier.requiresApproval) {
    const application = await prisma.accessApplication.findUnique({
      where: { tierId_userId: { tierId, userId } },
    });
    if (application?.status !== "approved") {
      return { ok: false, status: 403, error: "This tier requires an approved application" };
    }
  }

  if (tier.maxSubscribers) {
    const activeCount = await prisma.subscription.count({
      where: { tierId, status: "active", endsAt: { gt: new Date() } },
    });
    if (activeCount >= tier.maxSubscribers) {
      return { ok: false, status: 409, error: "This tier is full." };
    }
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      tierId: tier.id,
      amountCents: tier.priceCents,
      status: "pending",
      provider: "mock",
    },
  });

  return { ok: true, checkoutUrl: `/checkout/${transaction.id}`, transactionId: transaction.id };
}

export type WebhookEvent =
  | { type: "checkout.completed"; transactionId: string }
  | { type: "checkout.failed"; transactionId: string };

export type WebhookResult =
  | { ok: true; status: "succeeded"; subscriptionId: string }
  | { ok: true; status: "failed" }
  | { ok: false; error: string };

/**
 * Processes a (mock) payment provider event. Idempotent: replaying an event
 * for an already-resolved transaction returns its existing outcome instead
 * of reprocessing it.
 */
export async function handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
  const transaction = await prisma.transaction.findUnique({ where: { id: event.transactionId } });
  if (!transaction) {
    return { ok: false, error: "Transaction not found" };
  }

  if (transaction.status !== "pending") {
    if (transaction.status === "succeeded" && transaction.subscriptionId) {
      return { ok: true, status: "succeeded", subscriptionId: transaction.subscriptionId };
    }
    return { ok: true, status: "failed" };
  }

  if (event.type === "checkout.failed") {
    await prisma.transaction.update({ where: { id: transaction.id }, data: { status: "failed" } });
    return { ok: true, status: "failed" };
  }

  const tier = transaction.tierId
    ? await prisma.creatorTier.findUnique({ where: { id: transaction.tierId } })
    : null;

  if (!tier) {
    await prisma.transaction.update({ where: { id: transaction.id }, data: { status: "failed" } });
    return { ok: true, status: "failed" };
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setMonth(endsAt.getMonth() + SUBSCRIPTION_LENGTH_MONTHS);

  const subscription = await prisma.subscription.create({
    data: {
      subscriberId: transaction.userId,
      creatorId: tier.creatorId,
      tierId: tier.id,
      status: "active",
      startsAt,
      endsAt,
    },
  });

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: "succeeded", subscriptionId: subscription.id },
  });

  return { ok: true, status: "succeeded", subscriptionId: subscription.id };
}

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
