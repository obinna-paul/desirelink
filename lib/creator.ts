import { prisma } from "@/lib/prisma";

export const CREATOR_DASHBOARD_TABS = [
  { value: "overview", label: "Overview" },
  { value: "audience", label: "Audience" },
  { value: "content", label: "Content" },
  { value: "tiers", label: "Tiers" },
  { value: "applications", label: "Applications" },
  { value: "analytics", label: "Analytics" },
  { value: "verification", label: "Verification" },
] as const;

export type CreatorDashboardTab = (typeof CREATOR_DASHBOARD_TABS)[number]["value"];

export const DEFAULT_CREATOR_DASHBOARD_TAB: CreatorDashboardTab = "overview";

export function isCreatorDashboardTab(value: string | undefined): value is CreatorDashboardTab {
  return CREATOR_DASHBOARD_TABS.some((tab) => tab.value === value);
}

const GROWTH_MONTHS_BACK = 6;

export async function getCreatorProfileByUserId(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile?.isCreator) return null;
  return profile;
}

export async function getCreatorStats(profileId: string) {
  const [subscriberCount, revenueAgg, profile] = await Promise.all([
    prisma.subscription.count({ where: { creatorId: profileId, status: "active" } }),
    prisma.transaction.aggregate({
      where: { subscription: { creatorId: profileId } },
      _sum: { amountCents: true },
    }),
    prisma.profile.findUnique({ where: { id: profileId }, select: { profileViews: true } }),
  ]);

  return {
    subscriberCount,
    totalRevenueCents: revenueAgg._sum.amountCents ?? 0,
    profileViews: profile?.profileViews ?? 0,
  };
}

export async function getSubscribers(profileId: string) {
  return prisma.subscription.findMany({
    where: { creatorId: profileId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      tier: { select: { id: true, name: true } },
      subscriber: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
}

export async function getCreatorTiers(profileId: string) {
  return prisma.creatorTier.findMany({
    where: { creatorId: profileId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });
}

export type CreatorTierWithCount = Awaited<ReturnType<typeof getCreatorTiers>>[number];

export async function getCreatorApplications(profileId: string) {
  return prisma.accessApplication.findMany({
    where: { tier: { creatorId: profileId } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      createdAt: true,
      tier: { select: { id: true, name: true } },
      profile: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
}

export type CreatorApplication = Awaited<ReturnType<typeof getCreatorApplications>>[number];

function monthBuckets(monthsBack: number) {
  const now = new Date();
  const buckets: { label: string; start: Date; end: Date }[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({ label: start.toLocaleDateString(undefined, { month: "short" }), start, end });
  }

  return buckets;
}

export async function getSubscriberGrowth(profileId: string) {
  const buckets = monthBuckets(GROWTH_MONTHS_BACK);

  const subscriptions = await prisma.subscription.findMany({
    where: { creatorId: profileId },
    select: { createdAt: true },
  });

  let cumulative = subscriptions.filter((sub) => sub.createdAt < buckets[0].start).length;

  return buckets.map((bucket) => {
    cumulative += subscriptions.filter(
      (sub) => sub.createdAt >= bucket.start && sub.createdAt < bucket.end
    ).length;
    return { month: bucket.label, subscribers: cumulative };
  });
}

export async function getEarningsByMonth(profileId: string) {
  const buckets = monthBuckets(GROWTH_MONTHS_BACK);

  const transactions = await prisma.transaction.findMany({
    where: { subscription: { creatorId: profileId }, createdAt: { gte: buckets[0].start } },
    select: { createdAt: true, amountCents: true },
  });

  return buckets.map((bucket) => {
    const totalCents = transactions
      .filter((tx) => tx.createdAt >= bucket.start && tx.createdAt < bucket.end)
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    return { month: bucket.label, earnings: Math.round(totalCents) / 100 };
  });
}

export function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
