import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
  tierType: string;
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
  const byCreator = await getPublicTiersForCreators([creatorProfileId], viewerProfileId);
  return byCreator.get(creatorProfileId) ?? [];
}

/**
 * The multi-creator batch behind getPublicTiers - one set of queries covering every
 * creator's tiers and the viewer's state against all of them, rather than a query set
 * per creator. Used wherever tier state is needed for more than one creator at a time
 * (see computeSubscribePrompts in lib/posts.ts).
 */
export async function getPublicTiersForCreators(
  creatorProfileIds: string[],
  viewerProfileId: string | null,
): Promise<Map<string, PublicTierView[]>> {
  const byCreator = new Map<string, PublicTierView[]>();
  const uniqueCreatorIds = Array.from(new Set(creatorProfileIds));
  if (uniqueCreatorIds.length === 0) return byCreator;

  let tiers: Prisma.CreatorTierGetPayload<{
    include: { _count: { select: { subscriptions: true } } };
  }>[];

  try {
    tiers = await prisma.creatorTier.findMany({
      where: { creatorId: { in: uniqueCreatorIds } },
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            subscriptions: { where: { status: "active" } },
          },
        },
      },
    });
  } catch (error) {
    if (isMissingSchemaError(error, "CreatorTier.tierType")) {
      console.warn("Public tiers are unavailable until the CreatorTier.tierType migration is applied.");
      return byCreator;
    }
    throw error;
  }

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
    viewerProfileId && tierIds.length > 0
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

  for (const tier of tiers) {
    const isOwner = viewerProfileId === tier.creatorId;
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

    const view: PublicTierView = {
      id: tier.id,
      name: tier.name,
      description: tier.description,
      priceCents: tier.priceCents,
      tierType: tier.tierType,
      isLimited: tier.isLimited,
      requiresApproval: tier.requiresApproval,
      maxSubscribers: tier.maxSubscribers,
      subscriberCount,
      viewerState,
    };

    const existing = byCreator.get(tier.creatorId);
    if (existing) {
      existing.push(view);
    } else {
      byCreator.set(tier.creatorId, [view]);
    }
  }

  return byCreator;
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

