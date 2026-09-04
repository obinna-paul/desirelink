import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { processPaymentEvent } from "@/lib/payments/webhook-handler";
import { getProviderProfile } from "@/lib/provider-types";
import { creditProviderWallet } from "@/lib/wallet";
import { safeConfirmPayment } from "@/lib/payments/safe-call";

export { CREATOR_PROFILE_TYPES, isProviderProfileType, getProviderProfile } from "@/lib/provider-types";

const SUBSCRIPTION_LENGTH_MONTHS = 1;

/** Reuses an existing payment-provider customer for this profile, creating one on first use. */
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

export type ProviderSubscribeResult =
  | { ok: true; state: "subscribed" }
  | { ok: true; state: "pending" }
  | { ok: true; state: "checkout"; checkoutUrl: string }
  | { ok: false; status: number; error: string };

/**
 * Subscribes `subscriberId` to one of `providerId`'s tiers. If the subscriber
 * already has a saved card, this charges it directly and the
 * ProviderSubscription is active immediately. Otherwise it starts a hosted
 * checkout to collect a card first — the pending ProviderSubscription row is
 * created up front and confirmed by confirmProviderPayment() once the
 * customer redirects back (see app/api/providers/[providerId]/subscribe/route.ts).
 */
export async function subscribeToProvider(
  subscriberId: string,
  providerId: string,
  tierId: string,
  urls: { successUrl: string; cancelUrl: string }
): Promise<ProviderSubscribeResult> {
  if (subscriberId === providerId) {
    return { ok: false, status: 400, error: "You can't subscribe to your own tier" };
  }

  const provider = await getProviderProfile(providerId);
  if (!provider) {
    return { ok: false, status: 404, error: "Creator not found" };
  }

  const tier = await prisma.creatorTier.findUnique({ where: { id: tierId } });
  if (!tier || tier.creatorId !== providerId) {
    return { ok: false, status: 404, error: "Tier not found" };
  }

  const [existingProviderSub, existingLegacySub] = await Promise.all([
    prisma.providerSubscription.findFirst({
      where: { subscriberId, tierId, status: "active", endsAt: { gt: new Date() } },
    }),
    prisma.subscription.findFirst({
      where: { subscriberId, tierId, status: "active", endsAt: { gt: new Date() } },
    }),
  ]);
  if (existingProviderSub || existingLegacySub) {
    return { ok: true, state: "subscribed" };
  }

  if (tier.requiresApproval) {
    const application = await prisma.accessApplication.findUnique({
      where: { tierId_userId: { tierId, userId: subscriberId } },
    });

    if (application?.status === "pending") {
      return { ok: true, state: "pending" };
    }
    if (application?.status !== "approved") {
      await prisma.accessApplication.upsert({
        where: { tierId_userId: { tierId, userId: subscriberId } },
        create: { tierId, userId: subscriberId, status: "pending" },
        update: { status: "pending" },
      });
      return { ok: true, state: "pending" };
    }
  }

  if (tier.maxSubscribers) {
    const [providerSubCount, legacySubCount] = await Promise.all([
      prisma.providerSubscription.count({
        where: { tierId, status: "active", endsAt: { gt: new Date() } },
      }),
      prisma.subscription.count({
        where: { tierId, status: "active", endsAt: { gt: new Date() } },
      }),
    ]);
    if (providerSubCount + legacySubCount >= tier.maxSubscribers) {
      return { ok: false, status: 409, error: "This tier is full." };
    }
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setMonth(endsAt.getMonth() + SUBSCRIPTION_LENGTH_MONTHS);

  try {
    const subscriber = await prisma.profile.findUniqueOrThrow({
      where: { id: subscriberId },
      select: { paymentCustomerId: true },
    });
    const customerId = await getOrCreatePaymentCustomerId(subscriberId, subscriber.paymentCustomerId);
    const defaultCard = await prisma.paymentMethod.findFirst({ where: { userId: subscriberId, isDefault: true } });

    if (defaultCard) {
      const { reference, success } = await paymentProvider.chargeSavedPaymentMethod(
        customerId,
        defaultCard.externalId,
        tier.priceCents,
        { kind: "provider_tier", providerId, tierId }
      );
      if (!success) {
        return { ok: false, status: 402, error: "Your saved card was declined. Try updating your payment method." };
      }
      await prisma.providerSubscription.create({
        data: { subscriberId, providerId, tierId, status: "active", paymentSubscriptionId: reference, startsAt, endsAt },
      });
      await prisma.transaction.create({
        data: { userId: subscriberId, tierId, amountCents: tier.priceCents, status: "succeeded", provider: "card" },
      });
      await creditProviderWallet(providerId, tier.priceCents);
      return { ok: true, state: "subscribed" };
    }

    const pending = await prisma.providerSubscription.create({
      data: { subscriberId, providerId, tierId, status: "pending", startsAt, endsAt },
    });

    const checkoutUrl = await paymentProvider.createCheckoutSession(
      customerId,
      tier.priceCents,
      urls.successUrl,
      urls.cancelUrl,
      { kind: "provider_tier", pendingId: pending.id }
    );

    return { ok: true, state: "checkout", checkoutUrl };
  } catch (error) {
    console.error("[payments] subscribeToProvider failed", error);
    return { ok: false, status: 502, error: "We couldn't reach the payment provider. Please try again in a moment." };
  }
}

/**
 * Confirms a pending ProviderSubscription after the subscriber returns from
 * checkout, by verifying the transaction reference directly with the payment
 * provider rather than trusting the redirect alone (Paystack's recommended
 * pattern). Safe to call more than once — processPaymentEvent no-ops once
 * the pending row is no longer "pending".
 */
export async function confirmProviderPayment(reference: string): Promise<void> {
  await safeConfirmPayment("confirmProviderPayment", async () => {
    const event = await paymentProvider.verifyTransaction(reference);
    await processPaymentEvent(event);
  });
}

export type ProviderUnsubscribeResult = { ok: true } | { ok: false; status: number; error: string };

/** Cancels a subscriber's active subscription(s) to a provider, keeping access until the current period ends. */
export async function unsubscribeFromProvider(
  subscriberId: string,
  providerId: string,
  tierId?: string
): Promise<ProviderUnsubscribeResult> {
  const subscriptions = await prisma.providerSubscription.findMany({
    where: { subscriberId, providerId, tierId, status: "active" },
  });

  if (subscriptions.length === 0) {
    return { ok: false, status: 404, error: "No active subscription found" };
  }

  await prisma.providerSubscription.updateMany({
    where: { id: { in: subscriptions.map((subscription) => subscription.id) } },
    data: { cancelAtPeriodEnd: true },
  });

  return { ok: true };
}

/** Cancels one specific subscription by its own id (rather than by provider+tier), for
 * the "My subscriptions" settings page where a fan picks a row to cancel directly. Same
 * soft-cancel as unsubscribeFromProvider: access is kept until the current period ends. */
export async function cancelProviderSubscriptionById(
  subscriptionId: string,
  subscriberId: string,
): Promise<ProviderUnsubscribeResult> {
  const subscription = await prisma.providerSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.subscriberId !== subscriberId) {
    return { ok: false, status: 404, error: "Subscription not found" };
  }
  if (subscription.status !== "active") {
    return { ok: true };
  }

  await prisma.providerSubscription.update({
    where: { id: subscriptionId },
    data: { cancelAtPeriodEnd: true },
  });

  return { ok: true };
}
