import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { getAccountByProfileId } from "@/lib/email/notifications";
import { SubscriptionConfirmedEmail } from "@/components/emails/subscription-confirmed";
import { NewSubscriberEmail } from "@/components/emails/new-subscriber";
import { SubscriptionReceiptEmail } from "@/components/emails/subscription-receipt";
import { SubscriptionExpiryWarningEmail } from "@/components/emails/subscription-expiry-warning";
import { SubscriptionEndedFanEmail } from "@/components/emails/subscription-ended-fan";
import { SubscriptionEndedCreatorEmail } from "@/components/emails/subscription-ended-creator";
import { PaymentFailedEmail } from "@/components/emails/payment-failed";
import { SubscriptionCancelledEmail } from "@/components/emails/subscription-cancelled";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-NG", { dateStyle: "medium" });
}

/**
 * Fires the three emails that always travel together the moment a subscription actually
 * activates - fan confirmation, creator new-subscriber notice, and the fan's receipt.
 * Called from both places a ProviderSubscription can go active: the immediate
 * saved-card charge in subscribeToProvider, and the async checkout confirmation in
 * processPaymentEvent's charge.succeeded branch - never from the "already subscribed"
 * short-circuit, since nothing new happened there.
 */
export async function sendSubscriptionActivatedEmails(
  subscriberId: string,
  providerId: string,
  tierId: string,
  amountCents: number,
  reference: string,
  endsAtDate: Date,
): Promise<void> {
  const [subscriber, provider, tier] = await Promise.all([
    prisma.profile.findUnique({ where: { id: subscriberId }, select: { displayName: true, user: { select: { email: true } } } }),
    prisma.profile.findUnique({ where: { id: providerId }, select: { username: true, displayName: true, user: { select: { email: true } } } }),
    prisma.creatorTier.findUnique({ where: { id: tierId }, select: { name: true } }),
  ]);
  if (!subscriber || !provider || !tier) return;

  const endsAt = formatDate(endsAtDate);

  await Promise.all([
    sendEmail({
      to: subscriber.user.email,
      subject: `You're subscribed to ${provider.displayName}`,
      react: SubscriptionConfirmedEmail({
        creatorName: provider.displayName,
        creatorUsername: provider.username,
        tierName: tier.name,
        priceCents: amountCents,
        endsAt,
      }),
      category: "billing",
      template: "subscription-confirmed",
    }),
    sendEmail({
      to: provider.user.email,
      subject: `${subscriber.displayName} just subscribed to ${tier.name}`,
      react: NewSubscriberEmail({ fanName: subscriber.displayName, tierName: tier.name, amountCents }),
      category: "billing",
      template: "new-subscriber",
    }),
    sendEmail({
      to: subscriber.user.email,
      subject: `Your Udala receipt — ${tier.name}`,
      react: SubscriptionReceiptEmail({
        creatorName: provider.displayName,
        tierName: tier.name,
        amountCents,
        date: formatDate(new Date()),
        reference,
      }),
      category: "billing",
      template: "subscription-receipt",
    }),
  ]);
}

export async function sendSubscriptionExpiryWarningEmail(params: {
  subscriberEmail: string;
  creatorName: string;
  creatorUsername: string;
  tierName: string;
  endsAt: Date;
}): Promise<void> {
  await sendEmail({
    to: params.subscriberEmail,
    subject: `Your ${params.creatorName} subscription ends in 3 days`,
    react: SubscriptionExpiryWarningEmail({
      creatorName: params.creatorName,
      creatorUsername: params.creatorUsername,
      tierName: params.tierName,
      endsAt: formatDate(params.endsAt),
    }),
    category: "billing",
    template: "subscription-expiry-warning",
  });
}

export async function sendSubscriptionEndedFanEmail(params: {
  subscriberEmail: string;
  creatorName: string;
  creatorUsername: string;
  endsAt: Date;
}): Promise<void> {
  await sendEmail({
    to: params.subscriberEmail,
    subject: `Your subscription to ${params.creatorName} has ended`,
    react: SubscriptionEndedFanEmail({
      creatorName: params.creatorName,
      creatorUsername: params.creatorUsername,
      endsAt: formatDate(params.endsAt),
    }),
    category: "billing",
    template: "subscription-ended-fan",
  });
}

export async function sendSubscriptionEndedCreatorEmail(params: {
  creatorEmail: string;
  fanName: string;
  tierName: string;
  endsAt: Date;
}): Promise<void> {
  await sendEmail({
    to: params.creatorEmail,
    subject: `${params.fanName}'s subscription to ${params.tierName} ended`,
    react: SubscriptionEndedCreatorEmail({
      fanName: params.fanName,
      tierName: params.tierName,
      endsAt: formatDate(params.endsAt),
    }),
    category: "billing",
    template: "subscription-ended-creator",
  });
}

/** description is a short human phrase already assembled by the caller (e.g. "your
 * Inner Circle subscription", "your Hearts purchase", "your booking") - kept generic so
 * one template covers every kind of failed charge in lib/payments/webhook-handler.ts. */
export async function sendPaymentFailedEmail(profileId: string, description: string, amountCents: number): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: `We couldn't process your payment for ${description}`,
    react: PaymentFailedEmail({ description, amountCents }),
    category: "billing",
    template: "payment-failed",
  });
}

export async function sendSubscriptionCancelledEmail(subscriberId: string, providerId: string, endsAt: Date): Promise<void> {
  const [subscriber, provider] = await Promise.all([
    getAccountByProfileId(subscriberId),
    prisma.profile.findUnique({ where: { id: providerId }, select: { displayName: true } }),
  ]);
  if (!subscriber || !provider) return;

  await sendEmail({
    to: subscriber.user.email,
    subject: `You've cancelled your ${provider.displayName} subscription`,
    react: SubscriptionCancelledEmail({ creatorName: provider.displayName, endsAt: formatDate(endsAt) }),
    category: "billing",
    template: "subscription-cancelled",
  });
}
