import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { creditProviderWallet } from "@/lib/wallet";
import { sendPaymentFailedEmail, sendSubscriptionActivatedEmails } from "@/lib/email/billing-notifications";
import { sendNewBookingRequestEmail } from "@/lib/email/booking-notifications";
import {
  getPaymentCurrency,
  getPaymentProviderName,
  requiresLivePayments,
} from "./config";
import { getSubscriptionPeriod } from "./subscription-period";
import type { WebhookEvent, WebhookPaymentMethod } from "./types";

type Db = Prisma.TransactionClient;

function activeProviderName(): string {
  return getPaymentProviderName();
}

type PaymentEventOutcome =
  | {
      kind: "provider_subscription_activated";
      subscriptionId: string;
      subscriberId: string;
      providerId: string;
      tierId: string;
      amountCents: number;
      reference: string;
      endsAt: Date;
    }
  | {
      kind: "provider_subscription_failed";
      subscriberId: string;
      amountCents: number;
    };

export class PaymentIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentIntegrityError";
  }
}

export function assertProviderTierPaymentIntegrity(
  event: WebhookEvent,
  expected: {
    pendingId: string;
    amountCents: number;
    customerId: string | null;
  },
): void {
  if (event.amountCents !== expected.amountCents) {
    throw new PaymentIntegrityError(
      `Subscription ${expected.pendingId} expected ${expected.amountCents} but provider reported ${event.amountCents ?? "no amount"}.`,
    );
  }
  if (event.currency?.toUpperCase() !== getPaymentCurrency()) {
    throw new PaymentIntegrityError(
      `Subscription ${expected.pendingId} expected ${getPaymentCurrency()} but provider reported ${event.currency ?? "no currency"}.`,
    );
  }
  if (!expected.customerId || event.customerId !== expected.customerId) {
    throw new PaymentIntegrityError(
      `Subscription ${expected.pendingId} does not belong to the customer reported by the provider.`,
    );
  }
  if (
    activeProviderName() === "paystack" &&
    requiresLivePayments() &&
    event.environment !== "live"
  ) {
    throw new PaymentIntegrityError(
      `Subscription ${expected.pendingId} came from a non-live Paystack transaction.`,
    );
  }
}

/** description is a short human phrase for whatever failed - "your X subscription",
 * "your Hearts purchase", "your booking" - see each call site below. */
async function notifyPaymentFailed(userId: string, description: string, amountCents: number): Promise<void> {
  await sendPaymentFailedEmail(userId, description, amountCents);
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
    tierId?: string;
  },
  db: Db,
): Promise<void> {
  await db.transaction.create({
    data: {
      userId: profileId,
      amountCents: event.amountCents ?? 0,
      status: extra.status,
      provider: activeProviderName(),
      providerReference: event.reference,
      providerSubscriptionId: extra.providerSubscriptionId,
      tierId: extra.tierId,
    },
  });
}

async function handleProviderTierEvent(
  event: WebhookEvent,
  db: Db,
): Promise<PaymentEventOutcome | null> {
  const pendingId = event.metadata.pendingId;
  if (!pendingId) return null;

  const pending = await db.providerSubscription.findUnique({
    where: { id: pendingId },
    include: {
      tier: { select: { priceCents: true } },
      subscriber: {
        select: { paymentCustomerId: true, displayName: true },
      },
    },
  });
  if (!pending || pending.status !== "pending") return null;

  if (event.type === "charge.succeeded") {
    assertProviderTierPaymentIntegrity(event, {
      pendingId,
      amountCents: pending.tier.priceCents,
      customerId: pending.subscriber.paymentCustomerId,
    });

    const { startsAt, endsAt } = getSubscriptionPeriod();
    await db.providerSubscription.update({
      where: { id: pendingId },
      data: {
        status: "active",
        paymentSubscriptionId: event.reference,
        pastDueSince: null,
        paymentRetryCount: 0,
        startsAt,
        endsAt,
      },
    });
    if (event.paymentMethod)
      await upsertPaymentMethod(pending.subscriberId, event.paymentMethod, db);
    await recordTransaction(
      pending.subscriberId,
      event,
      {
        status: "succeeded",
        providerSubscriptionId: pendingId,
        tierId: pending.tierId,
      },
      db,
    );
    await creditProviderWallet(pending.providerId, event.amountCents ?? 0, db);
    const conversionPostId = event.metadata.conversionPostId;
    if (conversionPostId) {
      await db.postUnlock.upsert({
        where: { postId_subscriberId: { postId: conversionPostId, subscriberId: pending.subscriberId } },
        create: { postId: conversionPostId, subscriberId: pending.subscriberId },
        update: {},
      });
    }
    if (pending.providerId !== pending.subscriberId) {
      try {
        await db.notification.create({
          data: {
            recipientId: pending.providerId,
            actorId: pending.subscriberId,
            type: "subscription",
            title: `${pending.subscriber.displayName} subscribed`,
            body: "You have a new subscriber.",
            href: "/creator-dashboard?tab=audience",
          },
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          (error.code !== "P2021" && error.code !== "P2022")
        ) {
          throw error;
        }
      }
    }

    return {
      kind: "provider_subscription_activated",
      subscriptionId: pending.id,
      subscriberId: pending.subscriberId,
      providerId: pending.providerId,
      tierId: pending.tierId,
      amountCents: pending.tier.priceCents,
      reference: event.reference!,
      endsAt,
    };
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
    return {
      kind: "provider_subscription_failed",
      subscriberId: pending.subscriberId,
      amountCents: event.amountCents ?? pending.tier.priceCents,
    };
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
    await notifyPaymentFailed(pending.userId, "your Hearts purchase", event.amountCents ?? 0);
  }
}

/**
 * A service booking's payment — the pending row is the ServiceBooking
 * itself, created "pending_payment" the moment the customer requests a slot
 * (see lib/service-bookings.ts's createServiceBooking). On success this is
 * the ONLY place the Transaction gets created, and it's deliberately left in
 * escrow ("held") rather than crediting the provider's wallet — that only
 * happens once the customer confirms completion (or the auto-release cron
 * fires), so a provider can't get paid for a booking they never delivered.
 */
async function handleServiceBookingEvent(event: WebhookEvent, db: Db): Promise<void> {
  const pendingId = event.metadata.pendingId;
  if (!pendingId) return;

  const pending = await db.serviceBooking.findUnique({ where: { id: pendingId } });
  if (!pending || pending.status !== "pending_payment") return;

  if (event.type === "charge.succeeded") {
    await db.serviceBooking.update({
      where: { id: pendingId },
      data: { status: "pending_provider" },
    });
    await db.transaction.create({
      data: {
        userId: pending.customerId,
        amountCents: event.amountCents ?? pending.priceCents,
        status: "succeeded",
        provider: activeProviderName(),
        providerReference: event.reference,
        serviceBookingId: pending.id,
        escrowStatus: "held",
      },
    });
    if (event.paymentMethod)
      await upsertPaymentMethod(pending.customerId, event.paymentMethod, db);
    await sendNewBookingRequestEmail(pending.id);
  } else {
    await db.serviceBooking.update({
      where: { id: pendingId },
      data: { status: "cancelled", declineReason: "Payment failed." },
    });
    await notifyPaymentFailed(pending.customerId, "your booking", event.amountCents ?? pending.priceCents);
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

async function dispatch(
  event: WebhookEvent,
  db: Db,
): Promise<PaymentEventOutcome | null> {
  if (event.type === "transfer.succeeded" || event.type === "transfer.failed") {
    await handleWalletWithdrawalEvent(event, db);
    return null;
  }
  if (event.type === "unknown" || event.type === "charge.pending") return null;

  switch (event.metadata.kind) {
    case "provider_tier":
      return handleProviderTierEvent(event, db);
    case "hearts_purchase":
      await handleHeartsPurchaseEvent(event, db);
      return null;
    case "service_booking":
      await handleServiceBookingEvent(event, db);
      return null;
    default:
      return null;
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
  if (
    event.type === "unknown" ||
    event.type === "charge.pending" ||
    !event.reference
  ) {
    return;
  }

  const outcome = await prisma.$transaction(async (tx) => {
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
        return null; // Already processed this exact event — no-op.
      }
      throw error;
    }

    return dispatch(event, tx);
  });

  if (outcome?.kind === "provider_subscription_activated") {
    await sendSubscriptionActivatedEmails(
      outcome.subscriberId,
      outcome.providerId,
      outcome.tierId,
      outcome.amountCents,
      outcome.reference,
      outcome.endsAt,
    );
  } else if (outcome?.kind === "provider_subscription_failed") {
    await notifyPaymentFailed(
      outcome.subscriberId,
      "your subscription",
      outcome.amountCents,
    );
  }
}
