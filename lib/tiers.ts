import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/legacy-checkout";

export type TierViewerState =
  | "owner"
  | "subscribed"
  | "pending"
  | "approved"
  | "denied"
  | "full"
  | "available";

export type PublicTierView = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  isLimited: boolean;
  requiresApproval: boolean;
  maxSubscribers: number | null;
  subscriberCount: number;
  viewerState: TierViewerState;
};

function isMissingSchemaError(error: unknown, tableName: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022") &&
    String(error.meta?.table ?? error.meta?.column ?? "").includes(tableName)
  );
}

export async function getPublicTiers(
  creatorProfileId: string,
  viewerProfileId: string | null
): Promise<PublicTierView[]> {
  const tiers = await prisma.creatorTier.findMany({
    where: { creatorId: creatorProfileId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          subscriptions: { where: { status: "active" } },
        },
      },
    },
  });

  const isOwner = viewerProfileId === creatorProfileId;
  const tierIds = tiers.map((tier) => tier.id);
  const now = new Date();
  let providerSubscriberCounts = new Map<string, number>();

  if (tierIds.length > 0) {
    try {
      const counts = await prisma.providerSubscription.groupBy({
        by: ["tierId"],
        where: { tierId: { in: tierIds }, status: "active", endsAt: { gt: now } },
        _count: { _all: true },
      });
      providerSubscriberCounts = new Map(counts.map((count) => [count.tierId, count._count._all]));
    } catch (error) {
      if (!isMissingSchemaError(error, "ProviderSubscription")) {
        throw error;
      }
      console.warn("Provider tier counts are unavailable until ProviderSubscription migrations are applied.");
    }
  }

  const [subscriptions, providerSubscriptions, applications] =
    !isOwner && viewerProfileId
      ? await Promise.all([
          prisma.subscription.findMany({
            where: {
              subscriberId: viewerProfileId,
              tierId: { in: tierIds },
              status: "active",
              endsAt: { gt: new Date() },
            },
            select: { tierId: true },
          }),
          getViewerProviderSubscriptions(viewerProfileId, tierIds),
          prisma.accessApplication.findMany({
            where: { userId: viewerProfileId, tierId: { in: tierIds } },
            select: { tierId: true, status: true },
          }),
        ])
      : [[], [], []];

  const subscribedTierIds = new Set([
    ...subscriptions.map((sub) => sub.tierId),
    ...providerSubscriptions.map((sub) => sub.tierId),
  ]);
  const applicationByTier = new Map(applications.map((app) => [app.tierId, app.status]));

  return tiers.map((tier) => {
    const subscriberCount = tier._count.subscriptions + (providerSubscriberCounts.get(tier.id) ?? 0);
    const isFull = Boolean(tier.maxSubscribers && subscriberCount >= tier.maxSubscribers);

    let viewerState: TierViewerState;
    if (isOwner) {
      viewerState = "owner";
    } else if (subscribedTierIds.has(tier.id)) {
      viewerState = "subscribed";
    } else if (applicationByTier.get(tier.id) === "pending") {
      viewerState = "pending";
    } else if (applicationByTier.get(tier.id) === "approved") {
      viewerState = "approved";
    } else if (applicationByTier.get(tier.id) === "denied") {
      viewerState = "denied";
    } else if (isFull) {
      viewerState = "full";
    } else {
      viewerState = "available";
    }

    return {
      id: tier.id,
      name: tier.name,
      description: tier.description,
      priceCents: tier.priceCents,
      isLimited: tier.isLimited,
      requiresApproval: tier.requiresApproval,
      maxSubscribers: tier.maxSubscribers,
      subscriberCount,
      viewerState,
    };
  });
}

async function getViewerProviderSubscriptions(viewerProfileId: string, tierIds: string[]) {
  try {
    return await prisma.providerSubscription.findMany({
      where: {
        subscriberId: viewerProfileId,
        tierId: { in: tierIds },
        status: "active",
        endsAt: { gt: new Date() },
      },
      select: { tierId: true },
    });
  } catch (error) {
    if (isMissingSchemaError(error, "ProviderSubscription")) {
      console.warn("Viewer provider subscriptions are unavailable until ProviderSubscription migrations are applied.");
      return [];
    }
    throw error;
  }
}

async function hasActiveSubscription(subscriberId: string, tierId: string): Promise<boolean> {
  const existing = await prisma.subscription.findFirst({
    where: { subscriberId, tierId, status: "active", endsAt: { gt: new Date() } },
    select: { id: true },
  });
  return Boolean(existing);
}

export type SubscribeResult =
  | { ok: true; state: "subscribed" | "pending" | "checkout"; checkoutUrl?: string }
  | { ok: false; status: number; error: string };

/**
 * Handles a click on "Subscribe" / "Apply" for a tier. Approval-gated tiers
 * submit an AccessApplication; everything else hands off to the payments
 * service to start a checkout session.
 */
export async function subscribeToTier(subscriberId: string, tierId: string): Promise<SubscribeResult> {
  const tier = await prisma.creatorTier.findUnique({ where: { id: tierId } });
  if (!tier) {
    return { ok: false, status: 404, error: "Tier not found" };
  }

  if (tier.creatorId === subscriberId) {
    return { ok: false, status: 400, error: "You can't subscribe to your own tier" };
  }

  if (await hasActiveSubscription(subscriberId, tierId)) {
    return { ok: true, state: "subscribed" };
  }

  if (tier.requiresApproval) {
    const existing = await prisma.accessApplication.findUnique({
      where: { tierId_userId: { tierId, userId: subscriberId } },
    });

    if (existing?.status === "pending" || existing?.status === "approved") {
      return { ok: true, state: "pending" };
    }

    await prisma.accessApplication.upsert({
      where: { tierId_userId: { tierId, userId: subscriberId } },
      create: { tierId, userId: subscriberId, status: "pending" },
      update: { status: "pending" },
    });

    return { ok: true, state: "pending" };
  }

  const checkout = await createCheckoutSession(subscriberId, tierId);
  if (!checkout.ok) {
    return { ok: false, status: checkout.status, error: checkout.error };
  }

  return { ok: true, state: "checkout", checkoutUrl: checkout.checkoutUrl };
}

/** Handles "Complete payment" once an approval-gated application has been approved. */
export async function completeApprovedPayment(
  subscriberId: string,
  tierId: string
): Promise<SubscribeResult> {
  if (await hasActiveSubscription(subscriberId, tierId)) {
    return { ok: true, state: "subscribed" };
  }

  const checkout = await createCheckoutSession(subscriberId, tierId);
  if (!checkout.ok) {
    return { ok: false, status: checkout.status, error: checkout.error };
  }

  return { ok: true, state: "checkout", checkoutUrl: checkout.checkoutUrl };
}
