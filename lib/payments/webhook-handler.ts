import { prisma } from "@/lib/prisma";
import { creditProviderWallet } from "@/lib/wallet";
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
    await creditProviderWallet(pending.providerId, event.amountCents ?? 0);
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

/**
 * A priced event's "going" RSVP checkout — the pending row here is the
 * Transaction itself (created against `eventId` by lib/rsvp.ts's setRsvp),
 * not a dedicated model like the other kinds, so success/failure updates
 * that same row rather than creating a new ledger entry.
 */
async function handleEventRsvpEvent(event: WebhookEvent): Promise<void> {
  const pendingId = event.metadata.pendingId;
  if (!pendingId) return;

  const pending = await prisma.transaction.findUnique({ where: { id: pendingId } });
  if (!pending || pending.status !== "pending" || !pending.eventId) return;

  if (event.type !== "charge.succeeded") {
    await prisma.transaction.update({ where: { id: pendingId }, data: { status: "failed" } });
    await notifyPaymentFailed(pending.userId);
    return;
  }

  const eventRow = await prisma.event.findUnique({ where: { id: pending.eventId } });
  if (!eventRow) {
    await prisma.transaction.update({ where: { id: pendingId }, data: { status: "failed" } });
    return;
  }

  if (eventRow.maxAttendees !== null && eventRow.currentAttendees >= eventRow.maxAttendees) {
    const existingRsvp = await prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId: eventRow.id, userId: pending.userId } },
    });
    if (existingRsvp?.status !== "going") {
      await prisma.transaction.update({ where: { id: pendingId }, data: { status: "failed" } });
      return;
    }
  }

  await prisma.$transaction(async (tx) => {
    const existingRsvp = await tx.eventRsvp.findUnique({
      where: { eventId_userId: { eventId: eventRow.id, userId: pending.userId } },
    });

    await tx.eventRsvp.upsert({
      where: { eventId_userId: { eventId: eventRow.id, userId: pending.userId } },
      create: { eventId: eventRow.id, userId: pending.userId, status: "going" },
      update: { status: "going" },
    });

    if (existingRsvp?.status !== "going") {
      await tx.event.update({ where: { id: eventRow.id }, data: { currentAttendees: { increment: 1 } } });
    }

    await tx.transaction.update({ where: { id: pendingId }, data: { status: "succeeded" } });
  });

  if (event.paymentMethod) await upsertPaymentMethod(pending.userId, event.paymentMethod);
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
 * Reconciles a payout transfer's final state. Paystack's transfer creation
 * call can come back "pending" (e.g. it requires OTP finalization, or just
 * hasn't settled yet) — this webhook is the only place that ever resolves
 * such a transfer, so a wallet debit made against a transfer that later
 * fails or gets reversed would otherwise never be refunded. Looked up by
 * `payoutReference` (the reference we generated at transfer time and that
 * Paystack always echoes back) rather than metadata, since transfer webhook
 * payloads don't reliably round-trip custom metadata the way charge events do.
 */
async function handleWalletWithdrawalEvent(event: WebhookEvent): Promise<void> {
  if (!event.reference) return;

  const withdrawal = await prisma.walletWithdrawal.findFirst({ where: { payoutReference: event.reference } });
  if (!withdrawal || withdrawal.status !== "pending") return;

  if (event.type === "transfer.succeeded") {
    await prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "success", paidAt: new Date() },
    });
    return;
  }

  // Failed or reversed: the money never left the platform balance (or came back), so refund the provider's wallet.
  await prisma.$transaction([
    prisma.walletWithdrawal.update({ where: { id: withdrawal.id }, data: { status: "failed" } }),
    prisma.profile.update({
      where: { id: withdrawal.providerId },
      data: { walletBalanceCents: { increment: withdrawal.amountCents } },
    }),
  ]);
}

/**
 * Processes a normalized payment event from either the async webhook route
 * or a synchronous post-redirect verifyTransaction() call (see
 * lib/billing.ts's confirmPendingPayment) — both produce the same
 * WebhookEvent shape, so this one function handles either path. `metadata`
 * carries which pending row this event confirms or fails: {kind, pendingId}.
 */
export async function processPaymentEvent(event: WebhookEvent): Promise<void> {
  if (event.type === "transfer.succeeded" || event.type === "transfer.failed") {
    return handleWalletWithdrawalEvent(event);
  }
  if (event.type === "unknown") return;

  switch (event.metadata.kind) {
    case "provider_tier":
      return handleProviderTierEvent(event);
    case "premium":
      return handlePremiumEvent(event);
    case "hearts_purchase":
      return handleHeartsPurchaseEvent(event);
    case "event_rsvp":
      return handleEventRsvpEvent(event);
    default:
      return;
  }
}
