import "server-only";

import type { SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * A viewer's paid relationship to one creator, derived from every active
 * subscription (ProviderSubscription and the legacy Subscription table -
 * see getCreatorAccess) that hasn't hit its endsAt yet. Tiers are cumulative:
 * a subscription to a ₦15,000 tier unlocks everything priced at or below
 * ₦15,000 for that creator, so only the highest price paid matters here.
 */
export type CreatorAccessInfo = {
  /** Highest-priced active tier the viewer holds with this creator, or null if none. */
  maxTierPriceCents: number | null;
  /** Whether the viewer has any active subscription at all to this creator - the
   * fallback rule for a premium post with no tierId (see Post.tierId in schema.prisma). */
  hasAnySub: boolean;
};

function mergeAccess(
  access: Map<string, CreatorAccessInfo>,
  creatorId: string,
  tierPriceCents: number,
): void {
  const existing = access.get(creatorId);
  access.set(creatorId, {
    maxTierPriceCents: Math.max(existing?.maxTierPriceCents ?? 0, tierPriceCents),
    hasAnySub: true,
  });
}

/**
 * Looks up a viewer's active (unexpired) subscription to each of the given creators.
 * This is the single source of truth for "does this viewer's subscription still count" -
 * the endsAt filter is what makes a subscription stop granting access the instant it
 * passes one month, on the very next read, independent of whether the daily expiry cron
 * has run yet (see runSubscriptionExpiry in lib/billing.ts, which is bookkeeping/
 * notifications on top of this, never the thing gating access).
 */
export async function getCreatorAccess(
  viewerId: string | null,
  creatorIds: string[],
): Promise<Map<string, CreatorAccessInfo>> {
  const access = new Map<string, CreatorAccessInfo>();
  if (!viewerId) return access;

  const uniqueCreatorIds = Array.from(new Set(creatorIds));
  if (uniqueCreatorIds.length === 0) return access;

  const now = new Date();

  const [providerSubs, legacySubs] = await Promise.all([
    prisma.providerSubscription.findMany({
      where: {
        subscriberId: viewerId,
        providerId: { in: uniqueCreatorIds },
        status: "active",
        endsAt: { gt: now },
      },
      select: { providerId: true, tier: { select: { priceCents: true } } },
    }),
    prisma.subscription.findMany({
      where: {
        subscriberId: viewerId,
        creatorId: { in: uniqueCreatorIds },
        status: "active",
        endsAt: { gt: now },
      },
      select: { creatorId: true, tier: { select: { priceCents: true } } },
    }),
  ]);

  for (const sub of providerSubs) mergeAccess(access, sub.providerId, sub.tier.priceCents);
  for (const sub of legacySubs) mergeAccess(access, sub.creatorId, sub.tier.priceCents);

  return access;
}

/** Every fan with a currently-active subscription to this creator, across both
 * ProviderSubscription and the legacy Subscription table - used to fan out
 * "creator went live" notifications (see lib/live-streams.ts). Unlike getCreatorAccess
 * this doesn't filter by endsAt: a notification list is best-effort and a subscription
 * expiring in the next few minutes is not worth a second query to exclude. */
export async function getActiveSubscriberIds(creatorId: string): Promise<string[]> {
  const [providerSubs, legacySubs] = await Promise.all([
    prisma.providerSubscription.findMany({
      where: { providerId: creatorId, status: "active" },
      select: { subscriberId: true },
    }),
    prisma.subscription.findMany({
      where: { creatorId, status: "active" },
      select: { subscriberId: true },
    }),
  ]);

  return Array.from(
    new Set([...providerSubs.map((sub) => sub.subscriberId), ...legacySubs.map((sub) => sub.subscriberId)]),
  );
}

/**
 * Post ids this viewer has been permanently granted, regardless of tier - the "conversion
 * post" they clicked Subscribe on before paying (see PostUnlock, written by
 * subscribeToProvider and handleProviderTierEvent). Never re-checked against subscription
 * status once granted.
 */
export async function getUnlockedPostIds(
  viewerId: string | null,
  postIds: string[],
): Promise<Set<string>> {
  if (!viewerId || postIds.length === 0) return new Set();

  const unlocks = await prisma.postUnlock.findMany({
    where: { subscriberId: viewerId, postId: { in: postIds } },
    select: { postId: true },
  });

  return new Set(unlocks.map((unlock) => unlock.postId));
}

export type PostAccessInput = {
  id: string;
  authorId: string;
  isSubscriberOnly: boolean;
  tier: { id: string; name: string; priceCents: number } | null;
};

export type RequiredTier = { id: string; name: string; priceCents: number };

export type PostAccessResult = {
  unlocked: boolean;
  /** The tier that would unlock this post, for locked-card copy - null for a free post,
   * an owner viewing their own post, or a premium post with no tier assigned (the
   * "any active subscription unlocks it" fallback has no single tier to name). */
  requiredTier: RequiredTier | null;
};

/**
 * The single place post-lock state is decided - used identically by the feed, a
 * creator's profile, and post detail, so "what unlocks this post" can never drift
 * between them. Access is cumulative (see CreatorAccessInfo), and a post's own author
 * always sees it regardless of subscription state.
 */
export function resolvePostAccess(
  post: PostAccessInput,
  access: Map<string, CreatorAccessInfo>,
  viewerId: string | null,
  unlockedPostIds: Set<string> = new Set(),
): PostAccessResult {
  if (!post.isSubscriberOnly) return { unlocked: true, requiredTier: null };
  if (viewerId && viewerId === post.authorId) return { unlocked: true, requiredTier: null };

  const requiredTier: RequiredTier | null = post.tier
    ? { id: post.tier.id, name: post.tier.name, priceCents: post.tier.priceCents }
    : null;

  if (unlockedPostIds.has(post.id)) return { unlocked: true, requiredTier };

  const info = access.get(post.authorId);
  if (!info) return { unlocked: false, requiredTier };

  if (!post.tier) return { unlocked: info.hasAnySub, requiredTier };

  return {
    unlocked: info.maxTierPriceCents !== null && info.maxTierPriceCents >= post.tier.priceCents,
    requiredTier,
  };
}

const creatorProfileSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const;

export type MySubscriptionRow = {
  id: string;
  status: "active" | "cancelled" | "expired";
  /** True once the fan has cancelled but access hasn't lapsed yet - status still reads
   * "active" until endsAt, so the UI needs this to show "cancelled, ends {date}" instead
   * of a live Cancel button for a subscription that's already been cancelled. Always
   * false for a legacy row: that table has no soft-cancel, only an immediate status flip. */
  cancelAtPeriodEnd: boolean;
  startsAt: Date;
  endsAt: Date;
  tier: { name: string; priceCents: number };
  creator: { id: string; username: string; displayName: string; avatarUrl: string };
};

/**
 * Every subscription a fan has held to any creator, merged from ProviderSubscription (the
 * table subscribeToProvider writes to - see lib/providers.ts) and the legacy Subscription
 * table, for the "My subscriptions" settings page.
 */
export async function getMySubscriptions(subscriberId: string): Promise<MySubscriptionRow[]> {
  const statuses = ["active", "cancelled", "expired"];

  const [legacy, providerSubs] = await Promise.all([
    prisma.subscription.findMany({
      where: { subscriberId, status: { in: statuses as SubscriptionStatus[] } },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        tier: { select: { name: true, priceCents: true } },
        creator: { select: creatorProfileSelect },
      },
    }),
    prisma.providerSubscription.findMany({
      where: { subscriberId, status: { in: statuses } },
      select: {
        id: true,
        status: true,
        cancelAtPeriodEnd: true,
        startsAt: true,
        endsAt: true,
        tier: { select: { name: true, priceCents: true } },
        provider: { select: creatorProfileSelect },
      },
    }),
  ]);

  const rows: MySubscriptionRow[] = [
    ...legacy.map((sub) => ({
      id: sub.id,
      status: sub.status as MySubscriptionRow["status"],
      cancelAtPeriodEnd: false,
      startsAt: sub.startsAt,
      endsAt: sub.endsAt,
      tier: sub.tier,
      creator: sub.creator,
    })),
    ...providerSubs.map((sub) => ({
      id: sub.id,
      status: sub.status as MySubscriptionRow["status"],
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      startsAt: sub.startsAt,
      endsAt: sub.endsAt,
      tier: sub.tier,
      creator: sub.provider,
    })),
  ];

  return rows.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
}
