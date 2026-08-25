import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";

/** Fixed at $5/month regardless of the subscriber's country or card currency. */
export const PREMIUM_SUBSCRIPTION_PRICE_CENTS = 500;

const PREMIUM_LENGTH_MONTHS = 1;

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

async function getOrCreatePaymentCustomerId(profileId: string, existingCustomerId: string | null): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { user: { select: { email: true } } },
  });

  const customerId = await paymentProvider.createCustomer(profileId, profile.user.email);
  await prisma.profile.update({ where: { id: profileId }, data: { paymentCustomerId: customerId } });
  return customerId;
}

export type PremiumSubscribeResult =
  | { ok: true; state: "subscribed" }
  | { ok: true; state: "checkout"; checkoutUrl: string }
  | { ok: false; status: number; error: string };

/** Mirrors subscribeToProvider (lib/providers.ts): charges a saved card directly, or starts checkout to collect one first. */
export async function subscribeToPremium(
  profileId: string,
  urls: { successUrl: string; cancelUrl: string }
): Promise<PremiumSubscribeResult> {
  if (await isPremiumUser(profileId)) {
    return { ok: true, state: "subscribed" };
  }

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { paymentCustomerId: true },
  });
  const customerId = await getOrCreatePaymentCustomerId(profileId, profile.paymentCustomerId);
  const defaultCard = await prisma.paymentMethod.findFirst({ where: { userId: profileId, isDefault: true } });

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setMonth(endsAt.getMonth() + PREMIUM_LENGTH_MONTHS);

  if (defaultCard) {
    const { reference, success } = await paymentProvider.chargeSavedPaymentMethod(
      customerId,
      defaultCard.externalId,
      PREMIUM_SUBSCRIPTION_PRICE_CENTS,
      { kind: "premium" }
    );
    if (!success) {
      return { ok: false, status: 402, error: "Your saved card was declined. Try updating your payment method." };
    }
    await prisma.premiumSubscription.upsert({
      where: { userId: profileId },
      create: {
        userId: profileId,
        status: "active",
        paymentCustomerId: customerId,
        paymentSubscriptionId: reference,
        currentPeriodStart: startsAt,
        currentPeriodEnd: endsAt,
      },
      update: {
        status: "active",
        paymentSubscriptionId: reference,
        currentPeriodStart: startsAt,
        currentPeriodEnd: endsAt,
        cancelAtPeriodEnd: false,
        pastDueSince: null,
        paymentRetryCount: 0,
      },
    });
    await prisma.transaction.create({
      data: { userId: profileId, amountCents: PREMIUM_SUBSCRIPTION_PRICE_CENTS, status: "succeeded", provider: "card", isPremium: true },
    });
    return { ok: true, state: "subscribed" };
  }

  const pending = await prisma.premiumSubscription.upsert({
    where: { userId: profileId },
    create: { userId: profileId, status: "pending", paymentCustomerId: customerId, currentPeriodStart: startsAt, currentPeriodEnd: endsAt },
    update: { status: "pending", currentPeriodStart: startsAt, currentPeriodEnd: endsAt },
  });

  const checkoutUrl = await paymentProvider.createCheckoutSession(
    customerId,
    PREMIUM_SUBSCRIPTION_PRICE_CENTS,
    urls.successUrl,
    urls.cancelUrl,
    { kind: "premium", pendingId: pending.id }
  );

  return { ok: true, state: "checkout", checkoutUrl };
}

export type CancelPremiumResult = { ok: true } | { ok: false; status: number; error: string };

export async function cancelPremium(profileId: string): Promise<CancelPremiumResult> {
  const premium = await prisma.premiumSubscription.findUnique({ where: { userId: profileId } });
  if (!premium || premium.status !== "active") {
    return { ok: false, status: 404, error: "No active Premium subscription found" };
  }

  await prisma.premiumSubscription.update({ where: { userId: profileId }, data: { cancelAtPeriodEnd: true } });
  return { ok: true };
}
