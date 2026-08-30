import { prisma } from "@/lib/prisma";
import type { WebhookEvent, WebhookPaymentMethod } from "./types";

function activeProviderName(): string {
  if (process.env.USE_MOCK_PAYMENTS === "true") return "mock";
  return "paystack";
}

/**
 * Placeholder for the payment-failed notification. This app doesn't have a
 * transactional email provider wired up yet — swap this for a real send
 * once one exists.
 */
async function notifyPaymentFailed(userId: string): Promise<void> {
  console.warn(`[payments] Payment failed for profile ${userId} — email notification not yet wired up.`);
}

/** Creates or refreshes the saved-card record for a profile from whatever the provider just returned. New cards become the default automatically. */
export async function upsertPaymentMethod(profileId: string, method: WebhookPaymentMethod): Promise<void> {
  const existing = await prisma.paymentMethod.findFirst({ where: { userId: profileId, externalId: method.id } });

  if (existing) {
    await prisma.paymentMethod.update({
      where: { id: existing.id },
      data: { last4: method.last4, brand: method.brand, expMonth: method.expMonth, expYear: method.expYear, country: method.country },
    });
    return;
  }

  const existingCardCount = await prisma.paymentMethod.count({ where: { userId: profileId } });
  await prisma.paymentMethod.create({
    data: {
      userId: profileId,
      externalId: method.id,
      last4: method.last4,
      brand: method.brand,
      expMonth: method.expMonth,
      expYear: method.expYear,
      country: method.country,
      isDefault: existingCardCount === 0,
    },
  });
}

async function recordTransaction(
  profileId: string,
  event: WebhookEvent,
  extra: { status: "succeeded" | "failed"; providerSubscriptionId?: string; isPremium?: boolean }
): Promise<void> {
  await prisma.transaction.create({
    data: {
      userId: profileId,
      amountCents: event.amountCents ?? 0,
      status: extra.status,
      provider: activeProviderName(),
      providerSubscriptionId: extra.providerSubscriptionId,
      isPremium: extra.isPremium ?? false,
    },
  });
}

async function handleProviderTierEvent(event: WebhookEvent): Promise<void> {
  const pendingId = event.metadata.pendingId;
  if (!pendingId) return;

  const pending = await prisma.providerSubscription.findUnique({ where: { id: pendingId } });
  if (!pending || pending.status !== "pending") return;

  if (event.type === "charge.succeeded") {
    await prisma.providerSubscription.update({
      where: { id: pendingId },
      data: { status: "active", paymentSubscriptionId: event.reference, pastDueSince: null, paymentRetryCount: 0 },
    });
    if (event.paymentMethod) await upsertPaymentMethod(pending.subscriberId, event.paymentMethod);
    await recordTransaction(pending.subscriberId, event, { status: "succeeded", providerSubscriptionId: pendingId });
  } else {
    await prisma.providerSubscription.update({ where: { id: pendingId }, data: { status: "failed" } });
    await recordTransaction(pending.subscriberId, event, { status: "failed", providerSubscriptionId: pendingId });
    await notifyPaymentFailed(pending.subscriberId);
  }
}

async function handleHeartsPurchaseEvent(event: WebhookEvent): Promise<void> {
  const pendingId = event.metadata.pendingId;
  if (!pendingId) return;

  const pending = await prisma.heartPurchase.findUnique({ where: { id: pendingId } });
  if (!pending || pending.status !== "pending") return;

  if (event.type === "charge.succeeded") {
    await prisma.$transaction([
      prisma.heartPurchase.update({
        where: { id: pendingId },
        data: { status: "succeeded", paymentReference: event.reference },
      }),
      prisma.profile.update({
        where: { id: pending.userId },
        data: { heartsBalance: { increment: pending.hearts } },
      }),
    ]);
    if (event.paymentMethod) await upsertPaymentMethod(pending.userId, event.paymentMethod);
    await recordTransaction(pending.userId, event, { status: "succeeded" });
  } else {
    await prisma.heartPurchase.update({ where: { id: pendingId }, data: { status: "failed" } });
    await recordTransaction(pending.userId, event, { status: "failed" });
    await notifyPaymentFailed(pending.userId);
  }
}

async function handlePremiumEvent(event: WebhookEvent): Promise<void> {
  const pendingId = event.metadata.pendingId;
  if (!pendingId) return;

  const pending = await prisma.premiumSubscription.findUnique({ where: { id: pendingId } });
  if (!pending || pending.status !== "pending") return;

  if (event.type === "charge.succeeded") {
    await prisma.premiumSubscription.update({
      where: { id: pendingId },
      data: { status: "active", paymentSubscriptionId: event.reference, pastDueSince: null, paymentRetryCount: 0 },
    });
    if (event.paymentMethod) await upsertPaymentMethod(pending.userId, event.paymentMethod);
    await recordTransaction(pending.userId, event, { status: "succeeded", isPremium: true });
  } else {
    await prisma.premiumSubscription.update({ where: { id: pendingId }, data: { status: "failed" } });
    await recordTransaction(pending.userId, event, { status: "failed", isPremium: true });
    await notifyPaymentFailed(pending.userId);
  }
}

/**
 * Processes a normalized payment event from either the async webhook route
 * or a synchronous post-redirect verifyTransaction() call (see
 * lib/billing.ts's confirmPendingPayment) — both produce the same
 * WebhookEvent shape, so this one function handles either path. `metadata`
 * carries which pending row this event confirms or fails: {kind, pendingId}.
 */
export async function processPaymentEvent(event: WebhookEvent): Promise<void> {
  if (event.type === "unknown") return;

  switch (event.metadata.kind) {
    case "provider_tier":
      return handleProviderTierEvent(event);
    case "premium":
      return handlePremiumEvent(event);
    case "hearts_purchase":
      return handleHeartsPurchaseEvent(event);
    default:
      return;
  }
}
