import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { PREMIUM_SUBSCRIPTION_PRICE_CENTS } from "@/lib/premium";

/**
 * Dunning policy for failed recurring payments, applied by
 * runSubscriptionRenewals below (this app owns retry scheduling directly,
 * rather than delegating to provider-side subscription objects — see
 * lib/payments/types.ts for why).
 */
export const MAX_PAYMENT_RETRY_ATTEMPTS = 3;
export const PAYMENT_RETRY_WINDOW_DAYS = 7;
export const PAST_DUE_CANCEL_AFTER_DAYS = 30;

export type PaymentMethodView = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  country: string;
  isDefault: boolean;
};

export async function getPaymentMethods(profileId: string): Promise<PaymentMethodView[]> {
  const methods = await prisma.paymentMethod.findMany({ where: { userId: profileId }, orderBy: { createdAt: "asc" } });
  return methods.map((method) => ({
    id: method.id,
    brand: method.brand,
    last4: method.last4,
    expMonth: method.expMonth,
    expYear: method.expYear,
    country: method.country,
    isDefault: method.isDefault,
  }));
}

export type RemoveCardResult = { ok: true } | { ok: false; status: number; error: string };

export async function removePaymentMethod(profileId: string, cardId: string): Promise<RemoveCardResult> {
  const card = await prisma.paymentMethod.findUnique({ where: { id: cardId } });
  if (!card || card.userId !== profileId) {
    return { ok: false, status: 404, error: "Card not found" };
  }

  const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { paymentCustomerId: true } });
  if (profile?.paymentCustomerId) {
    await paymentProvider.detachPaymentMethod(profile.paymentCustomerId, card.externalId);
  }
  await prisma.paymentMethod.delete({ where: { id: cardId } });

  if (card.isDefault) {
    const next = await prisma.paymentMethod.findFirst({ where: { userId: profileId }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  return { ok: true };
}

export type SetDefaultCardResult = { ok: true } | { ok: false; status: number; error: string };

/** Purely a record in our own database — neither Paystack nor Stripe has a server-side "default card" concept we rely on; every charge names its card explicitly. */
export async function setDefaultPaymentMethod(profileId: string, cardId: string): Promise<SetDefaultCardResult> {
  const card = await prisma.paymentMethod.findUnique({ where: { id: cardId } });
  if (!card || card.userId !== profileId) {
    return { ok: false, status: 404, error: "Card not found" };
  }

  await prisma.$transaction([
    prisma.paymentMethod.updateMany({ where: { userId: profileId }, data: { isDefault: false } }),
    prisma.paymentMethod.update({ where: { id: cardId }, data: { isDefault: true } }),
  ]);

  return { ok: true };
}

export type BillingOverview = {
  premium: {
    active: boolean;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date;
  } | null;
  providerSubscriptions: {
    id: string;
    providerId: string;
    providerUsername: string;
    providerDisplayName: string;
    tierName: string;
    status: string;
    endsAt: Date;
    cancelAtPeriodEnd: boolean;
  }[];
  paymentMethods: PaymentMethodView[];
  transactions: { id: string; amountCents: number; status: string; createdAt: Date; description: string }[];
};

export async function getBillingOverview(profileId: string): Promise<BillingOverview> {
  const [premium, providerSubs, paymentMethods, transactions] = await Promise.all([
    prisma.premiumSubscription.findUnique({ where: { userId: profileId } }),
    prisma.providerSubscription.findMany({
      where: { subscriberId: profileId, status: { in: ["active", "past_due"] } },
      include: {
        provider: { select: { username: true, displayName: true } },
        tier: { select: { name: true } },
      },
      orderBy: { startsAt: "desc" },
    }),
    getPaymentMethods(profileId),
    prisma.transaction.findMany({
      where: { userId: profileId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { tier: { select: { name: true } } },
    }),
  ]);

  return {
    premium:
      premium && premium.status !== "pending" && premium.status !== "failed"
        ? {
            active: premium.status === "active",
            status: premium.status,
            cancelAtPeriodEnd: premium.cancelAtPeriodEnd,
            currentPeriodEnd: premium.currentPeriodEnd,
          }
        : null,
    providerSubscriptions: providerSubs.map((sub) => ({
      id: sub.id,
      providerId: sub.providerId,
      providerUsername: sub.provider.username,
      providerDisplayName: sub.provider.displayName,
      tierName: sub.tier.name,
      status: sub.status,
      endsAt: sub.endsAt,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    })),
    paymentMethods,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      amountCents: transaction.amountCents,
      status: transaction.status,
      createdAt: transaction.createdAt,
      description: transaction.isPremium ? "Udala Premium" : (transaction.tier?.name ?? "Payment"),
    })),
  };
}

async function notifyPaymentFailed(userId: string): Promise<void> {
  console.warn(`[billing] Recurring payment failed for profile ${userId} — email notification not yet wired up.`);
}

async function chargeDefaultCard(
  customerId: string,
  subscriberId: string,
  amountCents: number,
  metadata: Record<string, string>
): Promise<{ success: boolean; reference: string | null }> {
  const card = await prisma.paymentMethod.findFirst({ where: { userId: subscriberId, isDefault: true } });
  if (!card) return { success: false, reference: null };

  const { reference, success } = await paymentProvider.chargeSavedPaymentMethod(
    customerId,
    card.externalId,
    amountCents,
    metadata
  );
  return { success, reference };
}

/** Renews or retries a single provider-tier subscription. Returns what happened, for the cron's summary counts. */
async function processProviderSubscription(
  sub: { id: string; subscriberId: string; providerId: string; tierId: string; status: string; endsAt: Date; cancelAtPeriodEnd: boolean; pastDueSince: Date | null; paymentRetryCount: number },
  now: Date
): Promise<"renewed" | "retried" | "cancelled" | "skipped"> {
  if (sub.status === "active" && sub.cancelAtPeriodEnd && sub.endsAt <= now) {
    await prisma.providerSubscription.update({ where: { id: sub.id }, data: { status: "cancelled" } });
    return "cancelled";
  }

  if (sub.status === "past_due") {
    const daysPastDue = (now.getTime() - (sub.pastDueSince ?? now).getTime()) / (1000 * 60 * 60 * 24);
    if (daysPastDue >= PAST_DUE_CANCEL_AFTER_DAYS) {
      await prisma.providerSubscription.update({ where: { id: sub.id }, data: { status: "cancelled" } });
      return "cancelled";
    }
    if (daysPastDue >= PAYMENT_RETRY_WINDOW_DAYS || sub.paymentRetryCount >= MAX_PAYMENT_RETRY_ATTEMPTS) {
      return "skipped"; // retries exhausted; wait out the grace period
    }
  } else if (!(sub.status === "active" && sub.endsAt <= now)) {
    return "skipped"; // not due yet
  }

  const [subscriber, tier] = await Promise.all([
    prisma.profile.findUnique({ where: { id: sub.subscriberId }, select: { paymentCustomerId: true } }),
    prisma.creatorTier.findUnique({ where: { id: sub.tierId }, select: { priceCents: true } }),
  ]);
  if (!subscriber?.paymentCustomerId || !tier) {
    await prisma.providerSubscription.update({
      where: { id: sub.id },
      data: { status: "past_due", pastDueSince: sub.pastDueSince ?? now, paymentRetryCount: sub.paymentRetryCount + 1 },
    });
    return "retried";
  }

  const { success, reference } = await chargeDefaultCard(subscriber.paymentCustomerId, sub.subscriberId, tier.priceCents, {
    kind: "provider_tier",
    providerId: sub.providerId,
    tierId: sub.tierId,
  });

  if (success) {
    const endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + 1);
    await prisma.providerSubscription.update({
      where: { id: sub.id },
      data: { status: "active", endsAt, paymentSubscriptionId: reference, pastDueSince: null, paymentRetryCount: 0 },
    });
    await prisma.transaction.create({
      data: { userId: sub.subscriberId, tierId: sub.tierId, providerSubscriptionId: sub.id, amountCents: tier.priceCents, status: "succeeded", provider: "card" },
    });
    return "renewed";
  }

  await prisma.providerSubscription.update({
    where: { id: sub.id },
    data: { status: "past_due", pastDueSince: sub.pastDueSince ?? now, paymentRetryCount: sub.paymentRetryCount + 1 },
  });
  await prisma.transaction.create({
    data: { userId: sub.subscriberId, tierId: sub.tierId, providerSubscriptionId: sub.id, amountCents: tier.priceCents, status: "failed", provider: "card" },
  });
  await notifyPaymentFailed(sub.subscriberId);
  return "retried";
}

async function processPremiumSubscription(
  sub: { userId: string; status: string; currentPeriodEnd: Date; cancelAtPeriodEnd: boolean; pastDueSince: Date | null; paymentRetryCount: number; paymentCustomerId: string | null },
  now: Date
): Promise<"renewed" | "retried" | "cancelled" | "skipped"> {
  if (sub.status === "active" && sub.cancelAtPeriodEnd && sub.currentPeriodEnd <= now) {
    await prisma.premiumSubscription.update({ where: { userId: sub.userId }, data: { status: "cancelled" } });
    return "cancelled";
  }

  if (sub.status === "past_due") {
    const daysPastDue = (now.getTime() - (sub.pastDueSince ?? now).getTime()) / (1000 * 60 * 60 * 24);
    if (daysPastDue >= PAST_DUE_CANCEL_AFTER_DAYS) {
      await prisma.premiumSubscription.update({ where: { userId: sub.userId }, data: { status: "cancelled" } });
      return "cancelled";
    }
    if (daysPastDue >= PAYMENT_RETRY_WINDOW_DAYS || sub.paymentRetryCount >= MAX_PAYMENT_RETRY_ATTEMPTS) {
      return "skipped";
    }
  } else if (!(sub.status === "active" && sub.currentPeriodEnd <= now)) {
    return "skipped";
  }

  if (!sub.paymentCustomerId) {
    await prisma.premiumSubscription.update({
      where: { userId: sub.userId },
      data: { status: "past_due", pastDueSince: sub.pastDueSince ?? now, paymentRetryCount: sub.paymentRetryCount + 1 },
    });
    return "retried";
  }

  const { success, reference } = await chargeDefaultCard(
    sub.paymentCustomerId,
    sub.userId,
    PREMIUM_SUBSCRIPTION_PRICE_CENTS,
    { kind: "premium" }
  );

  if (success) {
    const currentPeriodEnd = new Date(now);
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    await prisma.premiumSubscription.update({
      where: { userId: sub.userId },
      data: { status: "active", currentPeriodStart: now, currentPeriodEnd, paymentSubscriptionId: reference, pastDueSince: null, paymentRetryCount: 0 },
    });
    await prisma.transaction.create({
      data: { userId: sub.userId, amountCents: PREMIUM_SUBSCRIPTION_PRICE_CENTS, status: "succeeded", provider: "card", isPremium: true },
    });
    return "renewed";
  }

  await prisma.premiumSubscription.update({
    where: { userId: sub.userId },
    data: { status: "past_due", pastDueSince: sub.pastDueSince ?? now, paymentRetryCount: sub.paymentRetryCount + 1 },
  });
  await prisma.transaction.create({
    data: { userId: sub.userId, amountCents: PREMIUM_SUBSCRIPTION_PRICE_CENTS, status: "failed", provider: "card", isPremium: true },
  });
  await notifyPaymentFailed(sub.userId);
  return "retried";
}

/**
 * Meant to run daily. Renews any subscription due today, retries any
 * past-due one still inside its 7-day/3-attempt retry window, and cancels
 * anything that's been past-due for 30 days. See app/api/cron/subscription-renewals.
 */
export async function runSubscriptionRenewals(): Promise<{
  renewed: number;
  retried: number;
  cancelled: number;
}> {
  const now = new Date();
  const counts = { renewed: 0, retried: 0, cancelled: 0 };

  const providerSubs = await prisma.providerSubscription.findMany({
    where: { status: { in: ["active", "past_due"] } },
  });
  for (const sub of providerSubs) {
    const outcome = await processProviderSubscription(sub, now);
    if (outcome !== "skipped") counts[outcome]++;
  }

  const premiumSubs = await prisma.premiumSubscription.findMany({
    where: { status: { in: ["active", "past_due"] } },
  });
  for (const sub of premiumSubs) {
    const outcome = await processPremiumSubscription(sub, now);
    if (outcome !== "skipped") counts[outcome]++;
  }

  return counts;
}
