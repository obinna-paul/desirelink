import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { creditProviderWallet } from "@/lib/wallet";
import type { WebhookEvent, WebhookPaymentMethod } from "./types";

type Db = Prisma.TransactionClient;

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
  console.warn(
    `[payments] Payment failed for profile ${userId} — email notification not yet wired up.`,
  );
}

/** Creates or refreshes the saved-card record for a profile from whatever the provider just returned. New cards become the default automatically. */
export async function upsertPaymentMethod(
  profileId: string,
  method: WebhookPaymentMethod,
  db: Db,
): Promise<void> {
  const existing = await db.paymentMethod.findFirst({
    where: { userId: profileId, externalId: method.id },
  });

  if (existing) {
    await db.paymentMethod.update({
      where: { id: existing.id },
      data: {
        last4: method.last4,
        brand: method.brand,
        expMonth: method.expMonth,
        expYear: method.expYear,
        country: method.country,
      },
    });
    return;
  }

  const existingCardCount = await db.paymentMethod.count({
    where: { userId: profileId },
  });
  await db.paymentMethod.create({
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
  extra: {
    status: "succeeded" | "failed";
    providerSubscriptionId?: string;
  },
  db: Db,
): Promise<void> {
  await db.transaction.create({
    data: {
      userId: profileId,
      amountCents: event.amountCents ?? 0,
      status: extra.status,
      provider: activeProviderName(),
      providerSubscriptionId: extra.providerSubscriptionId,
    },
  });
}

async function handleProviderTierEvent(
  event: WebhookEvent,
  db: Db,
): Promise<void> {
  const pendingId = event.metadata.pendingId;
  if (!pendingId) return;

  const pending = await db.providerSubscription.findUnique({
    where: { id: pendingId },
  });
  if (!pending || pending.status !== "pending") return;

  if (event.type === "charge.succeeded") {
    await db.providerSubscription.update({
      where: { id: pendingId },
      data: {
        status: "active",
        paymentSubscriptionId: event.reference,
        pastDueSince: null,
        paymentRetryCount: 0,
      },
    });
    if (event.paymentMethod)
      await upsertPaymentMethod(pending.subscriberId, event.paymentMethod, db);
    await recordTransaction(
      pending.subscriberId,
      event,
      { status: "succeeded", providerSubscriptionId: pendingId },
      db,
    );
    await creditProviderWallet(pending.providerId, event.amountCents ?? 0, db);
  } else {
    await db.providerSubscription.update({
      where: { id: pendingId },
      data: { status: "failed" },
    });
    await recordTransaction(
      pending.subscriberId,
      event,
      { status: "failed", providerSubscriptionId: pendingId },
      db,
    );
    await notifyPaymentFailed(pending.subscriberId);
  }
}

async function handleHeartsPurchaseEvent(
  event: WebhookEvent,
  db: Db,
): Promise<void> {
  const pendingId = event.metadata.pendingId;
  if (!pendingId) return;

  const pending = await db.heartPurchase.findUnique({
    where: { id: pendingId },
  });
  if (!pending || pending.status !== "pending") return;

  if (event.type === "charge.succeeded") {
    await db.heartPurchase.update({
      where: { id: pendingId },
      data: { status: "succeeded", paymentReference: event.reference },
    });
    await db.profile.update({
      where: { id: pending.userId },
      data: { heartsBalance: { increment: pending.hearts } },
    });
    if (event.paymentMethod)
      await upsertPaymentMethod(pending.userId, event.paymentMethod, db);
    await recordTransaction(pending.userId, event, { status: "succeeded" }, db);
  } else {
    await db.heartPurchase.update({
      where: { id: pendingId },
      data: { status: "failed" },
    });
    await recordTransaction(pending.userId, event, { status: "failed" }, db);
    await notifyPaymentFailed(pending.userId);
  }
}

/**
 * A priced event's "going" RSVP checkout — the pending row here is the
 * Transaction itself (created against `eventId` by lib/rsvp.ts's setRsvp),
 * not a dedicated model like the other kinds, so success/failure updates
 * that same row rather than creating a new ledger entry.
 */
async function handleEventRsvpEvent(
  event: WebhookEvent,
  db: Db,
): Promise<void> {
  const pendingId = event.metadata.pendingId;
  if (!pendingId) return;

  const pending = await db.transaction.findUnique({ where: { id: pendingId } });
  if (!pending || pending.status !== "pending" || !pending.eventId) return;

  if (event.type !== "charge.succeeded") {
    await db.transaction.update({
      where: { id: pendingId },
      data: { status: "failed" },
    });
    await notifyPaymentFailed(pending.userId);
    return;
  }

  const eventRow = await db.event.findUnique({
    where: { id: pending.eventId },
  });
  if (!eventRow) {
    await db.transaction.update({
      where: { id: pendingId },
      data: { status: "failed" },
    });
    return;
  }

  if (
    eventRow.maxAttendees !== null &&
    eventRow.currentAttendees >= eventRow.maxAttendees
  ) {
    const existingRsvp = await db.eventRsvp.findUnique({
      where: {
        eventId_userId: { eventId: eventRow.id, userId: pending.userId },
      },
    });
    if (existingRsvp?.status !== "going") {
      await db.transaction.update({
        where: { id: pendingId },
        data: { status: "failed" },
      });
      return;
    }
  }

  const existingRsvp = await db.eventRsvp.findUnique({
    where: { eventId_userId: { eventId: eventRow.id, userId: pending.userId } },
  });

  await db.eventRsvp.upsert({
    where: { eventId_userId: { eventId: eventRow.id, userId: pending.userId } },
    create: { eventId: eventRow.id, userId: pending.userId, status: "going" },
    update: { status: "going" },
  });

  if (existingRsvp?.status !== "going") {
    await db.event.update({
      where: { id: eventRow.id },
      data: { currentAttendees: { increment: 1 } },
    });
  }

  await db.transaction.update({
    where: { id: pendingId },
    data: { status: "succeeded" },
  });

  if (event.paymentMethod)
    await upsertPaymentMethod(pending.userId, event.paymentMethod, db);
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
async function handleWalletWithdrawalEvent(
  event: WebhookEvent,
  db: Db,
): Promise<void> {
  if (!event.reference) return;

  const withdrawal = await db.walletWithdrawal.findFirst({
    where: { payoutReference: event.reference },
  });
  if (!withdrawal || withdrawal.status !== "pending") return;

  if (event.type === "transfer.succeeded") {
    await db.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "success", paidAt: new Date() },
    });
    return;
  }

  // Failed or reversed: the money never left the platform balance (or came back), so refund the provider's wallet.
  await db.walletWithdrawal.update({
    where: { id: withdrawal.id },
    data: { status: "failed" },
  });
  await db.profile.update({
    where: { id: withdrawal.providerId },
    data: { walletBalanceCents: { increment: withdrawal.amountCents } },
  });
}

async function dispatch(event: WebhookEvent, db: Db): Promise<void> {
  if (event.type === "transfer.succeeded" || event.type === "transfer.failed") {
    return handleWalletWithdrawalEvent(event, db);
  }
  if (event.type === "unknown") return;

  switch (event.metadata.kind) {
    case "provider_tier":
      return handleProviderTierEvent(event, db);
    case "hearts_purchase":
      return handleHeartsPurchaseEvent(event, db);
    case "event_rsvp":
      return handleEventRsvpEvent(event, db);
    default:
      return;
  }
}

/**
 * Processes a normalized payment event from either the async webhook route
 * or a synchronous post-redirect verifyTransaction() call (see
 * lib/billing.ts's confirmPendingPayment) — both produce the same
 * WebhookEvent shape, so this one function handles either path. `metadata`
 * carries which pending row this event confirms or fails: {kind, pendingId}.
 *
 * Idempotency: the event's `reference` is the provider's own transaction/
 * transfer id, unique per underlying payment. Before doing any state work,
 * this inserts a (provider, eventType, reference) row into
 * ProcessedPaymentEvent inside the SAME database transaction as the work
 * itself — so a duplicate delivery (a retried webhook, or the redirect-verify
 * path racing the real webhook for the same charge) either does the work and
 * records it, or finds the record already there and does nothing, with no
 * window where one could happen without the other.
 */
export async function processPaymentEvent(event: WebhookEvent): Promise<void> {
  if (event.type === "unknown" || !event.reference) return;

  await prisma.$transaction(async (tx) => {
    try {
      await tx.processedPaymentEvent.create({
        data: {
          provider: activeProviderName(),
          eventType: event.type,
          reference: event.reference!,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return; // Already processed this exact event — no-op.
      }
      throw error;
    }

    await dispatch(event, tx);
  });
}
