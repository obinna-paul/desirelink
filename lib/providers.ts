import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { processPaymentEvent } from "@/lib/payments/webhook-handler";
import { getProviderProfile } from "@/lib/provider-types";
import { safeConfirmPayment } from "@/lib/payments/safe-call";
import { sendSubscriptionCancelledEmail } from "@/lib/email/billing-notifications";
import { getSubscriptionPeriod } from "@/lib/payments/subscription-period";

export { CREATOR_PROFILE_TYPES, isProviderProfileType, getProviderProfile } from "@/lib/provider-types";

const PENDING_PAYMENT_WINDOW_MS = 30 * 60 * 1000;

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
  | { ok: true; state: "already_subscribed" }
  | { ok: true; state: "processing" }
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
  urls: { successUrl: string; cancelUrl: string },
  /** The specific post whose "Subscribe now" button started this checkout, if any - see
   * PostUnlock. Only honored when it actually belongs to this provider, so a client can't
   * pass an arbitrary post id from a different creator to get it unlocked for free. */
  conversionPostId?: string
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

  let unlockPostId: string | undefined;
  if (conversionPostId) {
    const conversionPost = await prisma.post.findUnique({
      where: { id: conversionPostId },
      select: { authorId: true },
    });
    if (conversionPost?.authorId === providerId) unlockPostId = conversionPostId;
  }

  let pendingId: string | null = null;
  try {
    const reservation = await prisma.$transaction(async (tx) => {
      // Serializes this subscriber/tier attempt and the tier capacity check
      // without holding a database lock during Paystack I/O.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('provider-subscription'), hashtext(${`${subscriberId}:${tierId}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('tier-capacity'), hashtext(${tierId}))`;

      const now = new Date();
      const [existingProviderSub, existingLegacySub] = await Promise.all([
        tx.providerSubscription.findFirst({
          where: {
            subscriberId,
            tierId,
            status: "active",
            endsAt: { gt: now },
          },
        }),
        tx.subscription.findFirst({
          where: {
            subscriberId,
            tierId,
            status: "active",
            endsAt: { gt: now },
          },
        }),
      ]);
      if (existingProviderSub || existingLegacySub) {
        return { state: "already_subscribed" as const };
      }

      const pendingCutoff = new Date(now.getTime() - PENDING_PAYMENT_WINDOW_MS);
      const existingPending = await tx.providerSubscription.findFirst({
        where: {
          subscriberId,
          tierId,
          status: "pending",
          createdAt: { gt: pendingCutoff },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existingPending) {
        return { state: "processing" as const };
      }

      await tx.providerSubscription.updateMany({
        where: {
          subscriberId,
          tierId,
          status: "pending",
          createdAt: { lte: pendingCutoff },
        },
        data: { status: "failed" },
      });

      if (tier.maxSubscribers) {
        const [providerSubCount, legacySubCount] = await Promise.all([
          tx.providerSubscription.count({
            where: { tierId, status: "active", endsAt: { gt: now } },
          }),
          tx.subscription.count({
            where: { tierId, status: "active", endsAt: { gt: now } },
          }),
        ]);
        if (providerSubCount + legacySubCount >= tier.maxSubscribers) {
          return { state: "full" as const };
        }
      }

      const { startsAt, endsAt } = getSubscriptionPeriod(now);
      const pending = await tx.providerSubscription.create({
        data: {
          subscriberId,
          providerId,
          tierId,
          status: "pending",
          startsAt,
          endsAt,
        },
      });
      return { state: "reserved" as const, pending };
    });

    if (reservation.state === "already_subscribed") {
      return { ok: true, state: "already_subscribed" };
    }
    if (reservation.state === "processing") {
      return { ok: true, state: "processing" };
    }
    if (reservation.state === "full") {
      return { ok: false, status: 409, error: "This tier is full." };
    }

    const pending = reservation.pending;
    pendingId = pending.id;
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
        {
          kind: "provider_tier",
          pendingId: pending.id,
          providerId,
          tierId,
          ...(unlockPostId ? { conversionPostId: unlockPostId } : {}),
        },
      );
      const event = await paymentProvider.verifyTransaction(reference);
      await processPaymentEvent(event);
      const confirmed = await prisma.providerSubscription.findUnique({
        where: { id: pending.id },
        select: { status: true },
      });
      if (confirmed?.status === "active") {
        return { ok: true, state: "subscribed" };
      }
      if (!success || confirmed?.status === "failed") {
        return {
          ok: false,
          status: 402,
          error: "Your saved card was declined. Try updating your payment method.",
        };
      }
      return { ok: true, state: "processing" };
    }

    const checkoutUrl = await paymentProvider.createCheckoutSession(
      customerId,
      tier.priceCents,
      urls.successUrl,
      urls.cancelUrl,
      unlockPostId
        ? { kind: "provider_tier", pendingId: pending.id, conversionPostId: unlockPostId }
        : { kind: "provider_tier", pendingId: pending.id }
    );

    return { ok: true, state: "checkout", checkoutUrl };
  } catch (error) {
    console.error("[payments] subscribeToProvider failed", error);
    if (pendingId) {
      // Leave the reservation pending. A provider response may have been lost
      // after the charge completed; its signed webhook can still reconcile it.
      console.warn(`[payments] subscription ${pendingId} awaits reconciliation`);
    }
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
    where: {
      subscriberId,
      providerId,
      tierId,
      status: "active",
      cancelAtPeriodEnd: false,
    },
  });

  if (subscriptions.length === 0) {
    return { ok: false, status: 404, error: "No active subscription found" };
  }

  const cancelled = await prisma.providerSubscription.updateMany({
    where: {
      id: { in: subscriptions.map((subscription) => subscription.id) },
      status: "active",
      cancelAtPeriodEnd: false,
    },
    data: { cancelAtPeriodEnd: true },
  });
  if (cancelled.count === 0) return { ok: true };

  await sendSubscriptionCancelledEmail(subscriberId, providerId, subscriptions[0].endsAt);

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
  if (subscription.status !== "active" || subscription.cancelAtPeriodEnd) {
    return { ok: true };
  }

  const cancelled = await prisma.providerSubscription.updateMany({
    where: {
      id: subscriptionId,
      status: "active",
      cancelAtPeriodEnd: false,
    },
    data: { cancelAtPeriodEnd: true },
  });
  if (cancelled.count === 0) return { ok: true };

  await sendSubscriptionCancelledEmail(subscription.subscriberId, subscription.providerId, subscription.endsAt);

  return { ok: true };
}
