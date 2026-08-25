import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { getProviderProfile } from "@/lib/provider-types";

export { PROVIDER_PROFILE_TYPES, isProviderProfileType, getProviderProfile } from "@/lib/provider-types";

const SUBSCRIPTION_LENGTH_MONTHS = 1;

/** Reuses an existing Stripe customer for this profile, creating one on first use. */
async function getOrCreateStripeCustomerId(profileId: string, existingCustomerId: string | null): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { user: { select: { email: true } } },
  });

  const customerId = await paymentProvider.createCustomer(profileId, profile.user.email);
  await prisma.profile.update({ where: { id: profileId }, data: { stripeCustomerId: customerId } });
  return customerId;
}

export type ProviderSubscribeResult =
  | { ok: true; state: "subscribed" }
  | { ok: true; state: "pending" }
  | { ok: true; state: "checkout"; checkoutUrl: string }
  | { ok: false; status: number; error: string };

/**
 * Subscribes `subscriberId` to one of `providerId`'s tiers. If the subscriber
 * already has a saved payment method, this bills them directly (Stripe
 * Billing) and the ProviderSubscription is active immediately. Otherwise it
 * starts a Stripe Checkout session to collect payment details first — the
 * pending ProviderSubscription row is created up front and confirmed by
 * confirmPendingProviderSubscription() once the customer lands back on
 * successUrl (see app/api/providers/[providerId]/subscribe/route.ts).
 */
export async function subscribeToProvider(
  subscriberId: string,
  providerId: string,
  tierId: string,
  urls: { successUrl: (pendingSubscriptionId: string) => string; cancelUrl: string }
): Promise<ProviderSubscribeResult> {
  if (subscriberId === providerId) {
    return { ok: false, status: 400, error: "You can't subscribe to your own tier" };
  }

  const provider = await getProviderProfile(providerId);
  if (!provider) {
    return { ok: false, status: 404, error: "Provider not found" };
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

  const subscriber = await prisma.profile.findUniqueOrThrow({
    where: { id: subscriberId },
    select: { stripeCustomerId: true },
  });
  const customerId = await getOrCreateStripeCustomerId(subscriberId, subscriber.stripeCustomerId);
  const paymentMethods = await paymentProvider.listPaymentMethods(customerId);

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setMonth(endsAt.getMonth() + SUBSCRIPTION_LENGTH_MONTHS);

  if (paymentMethods.length > 0) {
    const { subscriptionId } = await paymentProvider.createSubscription(customerId, tier.id);
    await prisma.providerSubscription.create({
      data: {
        subscriberId,
        providerId,
        tierId,
        status: "active",
        stripeSubscriptionId: subscriptionId,
        startsAt,
        endsAt,
      },
    });
    return { ok: true, state: "subscribed" };
  }

  const pending = await prisma.providerSubscription.create({
    data: { subscriberId, providerId, tierId, status: "pending", startsAt, endsAt },
  });

  const checkoutUrl = await paymentProvider.createCheckoutSession(
    customerId,
    tier.id,
    urls.successUrl(pending.id),
    urls.cancelUrl
  );

  return { ok: true, state: "checkout", checkoutUrl };
}

/**
 * Confirms a pending ProviderSubscription after the subscriber returns from
 * Stripe Checkout. In production this should ideally be corroborated by a
 * Stripe webhook rather than trusting the redirect alone; that requires
 * threading a client reference through PaymentProvider.createCheckoutSession,
 * which the current interface doesn't expose. Safe for the mock provider,
 * where there's no real payment to misattribute.
 */
export async function confirmPendingProviderSubscription(
  pendingSubscriptionId: string,
  viewerProfileId: string
): Promise<void> {
  await prisma.providerSubscription.updateMany({
    where: { id: pendingSubscriptionId, subscriberId: viewerProfileId, status: "pending" },
    data: { status: "active" },
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
