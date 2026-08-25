import { prisma } from "@/lib/prisma";
import { MAX_PAYMENT_RETRY_ATTEMPTS } from "./stripe-provider";
import type { WebhookEvent } from "./types";

/**
 * Placeholder for the payment-failed notification. This app doesn't have a
 * transactional email provider wired up yet — swap this for a real send
 * once one exists.
 */
async function notifyPaymentFailed(userId: string): Promise<void> {
  console.warn(`[payments] Payment failed for profile ${userId} — email notification not yet wired up.`);
}

/**
 * Applies a webhook event to our own subscription records. Both
 * PremiumSubscription (the platform "Udala Premium" plan) and
 * ProviderSubscription (a per-provider tier subscription) can share the same
 * underlying Stripe customer/subscription IDs, so we look up and update
 * whichever one the event actually belongs to.
 */
export async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "invoice.payment_succeeded": {
      await Promise.all([markPremiumActive(event), markProviderSubscriptionActive(event)]);
      return;
    }

    case "invoice.payment_failed": {
      await handlePaymentFailed(event);
      return;
    }

    case "customer.subscription.deleted": {
      await Promise.all([markPremiumCancelled(event), markProviderSubscriptionCancelled(event)]);
      return;
    }

    case "customer.subscription.updated":
    case "unknown":
    default:
      return;
  }
}

async function markPremiumActive(event: WebhookEvent): Promise<void> {
  if (!event.customerId) return;
  await prisma.premiumSubscription.updateMany({
    where: { stripeCustomerId: event.customerId },
    data: { status: "active" },
  });
}

async function markPremiumCancelled(event: WebhookEvent): Promise<void> {
  if (!event.customerId) return;
  await prisma.premiumSubscription.updateMany({
    where: { stripeCustomerId: event.customerId },
    data: { status: "cancelled", cancelAtPeriodEnd: false },
  });
}

async function markProviderSubscriptionActive(event: WebhookEvent): Promise<void> {
  if (!event.subscriptionId) return;
  await prisma.providerSubscription.updateMany({
    where: { stripeSubscriptionId: event.subscriptionId },
    data: { status: "active" },
  });
}

async function markProviderSubscriptionCancelled(event: WebhookEvent): Promise<void> {
  if (!event.subscriptionId) return;
  await prisma.providerSubscription.updateMany({
    where: { stripeSubscriptionId: event.subscriptionId },
    data: { status: "cancelled" },
  });
}

async function handlePaymentFailed(event: WebhookEvent): Promise<void> {
  if (!event.customerId) return;

  const subscription = await prisma.premiumSubscription.findFirst({
    where: { stripeCustomerId: event.customerId },
  });

  const retriesExhausted =
    event.attemptCount !== null && event.attemptCount >= MAX_PAYMENT_RETRY_ATTEMPTS;

  if (subscription) {
    await prisma.premiumSubscription.update({
      where: { id: subscription.id },
      data: { status: retriesExhausted ? "expired" : "past_due" },
    });
    await notifyPaymentFailed(subscription.userId);
  }

  // ProviderSubscription only tracks active/cancelled/expired (no past_due),
  // so it only moves once the dunning retries above are exhausted.
  if (retriesExhausted) {
    await markProviderSubscriptionCancelled(event);
  }
}
