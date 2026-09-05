import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { createNotification } from "@/lib/notifications";
import {
  sendSubscriptionEndedCreatorEmail,
  sendSubscriptionEndedFanEmail,
  sendSubscriptionExpiryWarningEmail,
} from "@/lib/email/billing-notifications";

/**
 * Subscriptions run for exactly one calendar month and are never auto-renewed or
 * re-charged — see runSubscriptionExpiry below. A fan who wants another month
 * subscribes again (a fresh checkout, a fresh ProviderSubscription row).
 */
export const SUBSCRIPTION_EXPIRY_WARNING_DAYS = 3;

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
  try {
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
  } catch (error) {
    if (isMissingSchemaError(error, "PaymentMethod")) {
      console.warn("Billing payment methods are unavailable until PaymentMethod migrations are applied.");
      return [];
    }
    throw error;
  }
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

/** Purely a record in our own database. Every charge names its saved Paystack authorization explicitly. */
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

function isMissingSchemaError(error: unknown, tableName: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022") &&
    String(error.meta?.table ?? error.meta?.column ?? "").includes(tableName)
  );
}

const providerSubscriptionInclude = {
  provider: { select: { username: true, displayName: true } },
  tier: { select: { name: true } },
} satisfies Prisma.ProviderSubscriptionInclude;

type BillingProviderSubscription = Prisma.ProviderSubscriptionGetPayload<{
  include: typeof providerSubscriptionInclude;
}>;

async function getActiveProviderSubscriptionsForBilling(
  profileId: string
): Promise<BillingProviderSubscription[]> {
  try {
    return await prisma.providerSubscription.findMany({
      where: { subscriberId: profileId, status: "active" },
      include: providerSubscriptionInclude,
      orderBy: { startsAt: "desc" },
    });
  } catch (error) {
    if (isMissingSchemaError(error, "ProviderSubscription")) {
      console.warn("Billing provider subscriptions are unavailable until ProviderSubscription migrations are applied.");
      return [];
    }
    throw error;
  }
}

export async function getBillingOverview(profileId: string): Promise<BillingOverview> {
  const [providerSubs, paymentMethods, transactions] = await Promise.all([
    getActiveProviderSubscriptionsForBilling(profileId),
    getPaymentMethods(profileId),
    prisma.transaction.findMany({
      where: { userId: profileId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { tier: { select: { name: true } } },
    }),
  ]);

  return {
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
      description: transaction.tier?.name ?? "Payment",
    })),
  };
}

const expiringSubscriptionInclude = {
  subscriber: { select: { id: true, displayName: true, user: { select: { email: true } } } },
  provider: { select: { id: true, username: true, displayName: true, user: { select: { email: true } } } },
  tier: { select: { name: true } },
} satisfies Prisma.ProviderSubscriptionInclude;

type ExpiringSubscription = Prisma.ProviderSubscriptionGetPayload<{
  include: typeof expiringSubscriptionInclude;
}>;

async function notifySubscriptionEndingSoon(sub: ExpiringSubscription): Promise<void> {
  await createNotification({
    recipientId: sub.subscriberId,
    actorId: sub.providerId,
    type: "subscription",
    title: `Your ${sub.tier.name} subscription ends in ${SUBSCRIPTION_EXPIRY_WARNING_DAYS} days`,
    body: `Resubscribe to keep your access to ${sub.provider.displayName}'s Premium content.`,
    href: `/profile/${sub.provider.username}`,
  });
  await sendSubscriptionExpiryWarningEmail({
    subscriberEmail: sub.subscriber.user.email,
    creatorName: sub.provider.displayName,
    creatorUsername: sub.provider.username,
    tierName: sub.tier.name,
    endsAt: sub.endsAt,
  });
}

async function notifySubscriptionEnded(sub: ExpiringSubscription): Promise<void> {
  await Promise.all([
    createNotification({
      recipientId: sub.subscriberId,
      actorId: sub.providerId,
      type: "subscription",
      title: `Your ${sub.tier.name} subscription to ${sub.provider.displayName} has ended`,
      body: "Resubscribe any time to get access again.",
      href: `/profile/${sub.provider.username}`,
    }),
    createNotification({
      recipientId: sub.providerId,
      actorId: sub.subscriberId,
      type: "subscription",
      title: `${sub.subscriber.displayName}'s ${sub.tier.name} subscription ended`,
      body: "Their access to your Premium content has ended.",
      href: "/creator-dashboard?tab=audience",
    }),
    sendSubscriptionEndedFanEmail({
      subscriberEmail: sub.subscriber.user.email,
      creatorName: sub.provider.displayName,
      creatorUsername: sub.provider.username,
      endsAt: sub.endsAt,
    }),
    sendSubscriptionEndedCreatorEmail({
      creatorEmail: sub.provider.user.email,
      fanName: sub.subscriber.displayName,
      tierName: sub.tier.name,
      endsAt: sub.endsAt,
    }),
  ]);
}

/**
 * Processes one subscription for the daily expiry sweep. Access itself is already gated
 * purely by endsAt (see getCreatorAccess in lib/subscription-access.ts) - this only
 * updates status for record-keeping and sends the two notifications the product asks
 * for: a heads-up a few days out, and a "this just ended" notice to both sides the
 * moment it lapses. Never charges a card or extends endsAt - subscriptions are exactly
 * one month, full stop; a fan who wants another month subscribes again.
 */
async function processSubscriptionExpiry(
  sub: ExpiringSubscription,
  now: Date,
  warnAt: Date,
): Promise<"expired" | "warned" | "skipped"> {
  if (sub.endsAt <= now) {
    await prisma.providerSubscription.update({
      where: { id: sub.id },
      data: { status: sub.cancelAtPeriodEnd ? "cancelled" : "expired" },
    });
    await notifySubscriptionEnded(sub);
    return "expired";
  }

  if (!sub.expiryWarningSentAt && sub.endsAt <= warnAt) {
    await prisma.providerSubscription.update({
      where: { id: sub.id },
      data: { expiryWarningSentAt: now },
    });
    await notifySubscriptionEndingSoon(sub);
    return "warned";
  }

  return "skipped";
}

/**
 * Meant to run daily (see app/api/cron/subscription-expiry). Ends any active
 * subscription whose month is up, and warns anyone within
 * SUBSCRIPTION_EXPIRY_WARNING_DAYS of that who hasn't already been warned.
 */
export async function runSubscriptionExpiry(): Promise<{
  expired: number;
  warned: number;
}> {
  const now = new Date();
  const warnAt = new Date(now);
  warnAt.setDate(warnAt.getDate() + SUBSCRIPTION_EXPIRY_WARNING_DAYS);
  const counts = { expired: 0, warned: 0 };

  const dueSubs = await prisma.providerSubscription.findMany({
    where: { status: "active", endsAt: { lte: warnAt } },
    include: expiringSubscriptionInclude,
  });
  for (const sub of dueSubs) {
    const outcome = await processSubscriptionExpiry(sub, now, warnAt);
    if (outcome !== "skipped") counts[outcome]++;
  }

  return counts;
}
