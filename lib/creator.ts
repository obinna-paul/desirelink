import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const CREATOR_DASHBOARD_TABS = [
  { value: "overview", label: "Overview" },
  { value: "assistant", label: "Assistant" },
  { value: "audience", label: "Audience" },
  { value: "content", label: "Content" },
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

function isMissingSchemaError(error: unknown, identifier: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022") &&
    String(error.meta?.table ?? error.meta?.column ?? "").includes(identifier)
  );
}

/**
 * Tier management kept its original "creator" naming in routes and database
 * tables, but it is now a capability any signed-in profile can set up.
 */
export async function getCreatorProfileByUserId(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return null;
  return profile;
}

export type CreatorStats = {
  subscriberCount: number;
  totalRevenueCents: number;
  profileViews: number;
};

export async function getCreatorStats(profileId: string): Promise<CreatorStats> {
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
  try {
    return await prisma.creatorTier.findMany({
      where: { creatorId: profileId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    });
  } catch (error) {
    if (isMissingSchemaError(error, "CreatorTier.tierType")) {
      console.warn("Creator tiers are unavailable until the CreatorTier.tierType migration is applied.");
      return [];
    }
    throw error;
  }
}

export type CreatorTierWithCount = Awaited<ReturnType<typeof getCreatorTiers>>[number];

export async function getCreatorApplications(profileId: string) {
  try {
    return await prisma.accessApplication.findMany({
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
  } catch (error) {
    if (isMissingSchemaError(error, "AccessApplication")) {
      console.warn("Tier applications are unavailable until AccessApplication migrations are applied.");
      return [];
    }
    throw error;
  }
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

const ASSISTANT_TOP_FAN_LIMIT = 5;
const ASSISTANT_DORMANT_FAN_LIMIT = 5;
const DORMANT_DAYS = 30;
const RECENT_ACTIVITY_DAYS = 90;

const QUICK_REPLY_TEMPLATES = [
  {
    title: "Welcome new subscriber",
    intent: "Start the relationship",
    body: "Thanks for joining my tier. I am glad you are here. Tell me what kind of posts you want more of.",
  },
  {
    title: "Re-engage quiet fan",
    intent: "Bring someone back",
    body: "Hey, I noticed it has been a little while. I have fresh updates coming this week and thought you might like them.",
  },
  {
    title: "Post drop teaser",
    intent: "Build anticipation",
    body: "New subscriber-only post is almost ready. I think this one is going to be worth checking in for.",
  },
  {
    title: "Thank top supporter",
    intent: "Reward loyalty",
    body: "I really appreciate your support. You have been one of the people helping me keep creating here.",
  },
] as const;

type AssistantProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
};

function daysAgo(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

function buildSuggestedPostTimes(activityDates: Date[], activeSubscriberCount: number) {
  const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const periods = [
    { label: "morning", start: 6, end: 12, time: "9:00 AM" },
    { label: "afternoon", start: 12, end: 17, time: "2:00 PM" },
    { label: "evening", start: 17, end: 22, time: "7:00 PM" },
    { label: "late night", start: 22, end: 24, time: "10:00 PM" },
  ];
  const fallback = [
    {
      label: "Friday evening",
      time: "7:00 PM",
      reason: activeSubscriberCount > 0 ? "Good default for subscriber check-ins" : "Mock starter slot",
    },
    {
      label: "Saturday late morning",
      time: "11:00 AM",
      reason: "Useful for weekend browsing",
    },
    {
      label: "Sunday evening",
      time: "8:00 PM",
      reason: "Works well for weekly previews",
    },
  ];

  const buckets = new Map<string, { label: string; time: string; count: number }>();
  for (const date of activityDates) {
    const hour = date.getHours();
    const period = periods.find((entry) => hour >= entry.start && hour < entry.end) ?? periods[0];
    const label = `${dayLabels[date.getDay()]} ${period.label}`;
    const existing = buckets.get(label) ?? { label, time: period.time, count: 0 };
    existing.count += 1;
    buckets.set(label, existing);
  }

  const suggestions = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((bucket) => ({
      label: bucket.label,
      time: bucket.time,
      reason: `${bucket.count} recent subscriber ${bucket.count === 1 ? "signal" : "signals"}`,
    }));

  for (const item of fallback) {
    if (suggestions.length >= 3) break;
    if (!suggestions.some((suggestion) => suggestion.label === item.label)) {
      suggestions.push(item);
    }
  }

  return suggestions;
}

export async function getCreatorAssistantInsights(profileId: string) {
  const dormantCutoff = new Date(Date.now() - DORMANT_DAYS * 24 * 60 * 60 * 1000);
  const recentActivityCutoff = new Date(Date.now() - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000);

  const [spendByFan, activeSubscriptions, recentTransactions, recentMessages] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["userId"],
      where: {
        status: "succeeded",
        OR: [{ subscription: { creatorId: profileId } }, { tier: { creatorId: profileId } }],
      },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.subscription.findMany({
      where: { creatorId: profileId, status: "active" },
      select: {
        subscriberId: true,
        startsAt: true,
        tier: { select: { name: true } },
        subscriber: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { startsAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        status: "succeeded",
        createdAt: { gte: recentActivityCutoff },
        OR: [{ subscription: { creatorId: profileId } }, { tier: { creatorId: profileId } }],
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.message.findMany({
      where: {
        createdAt: { gte: recentActivityCutoff },
        OR: [{ senderId: profileId }, { recipientId: profileId }],
      },
      select: { senderId: true, recipientId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const subscriberProfiles = new Map<string, AssistantProfile>();
  const subscriberStarts = new Map<string, Date>();
  const subscriberTiers = new Map<string, Set<string>>();

  for (const subscription of activeSubscriptions) {
    subscriberProfiles.set(subscription.subscriberId, subscription.subscriber);
    const existingStart = subscriberStarts.get(subscription.subscriberId);
    if (!existingStart || subscription.startsAt > existingStart) {
      subscriberStarts.set(subscription.subscriberId, subscription.startsAt);
    }
    const tiers = subscriberTiers.get(subscription.subscriberId) ?? new Set<string>();
    tiers.add(subscription.tier.name);
    subscriberTiers.set(subscription.subscriberId, tiers);
  }

  const spendingProfiles = new Map(subscriberProfiles);
  const missingSpendingProfileIds = spendByFan
    .map((fan) => fan.userId)
    .filter((fanId) => !spendingProfiles.has(fanId));

  if (missingSpendingProfileIds.length > 0) {
    const profiles = await prisma.profile.findMany({
      where: { id: { in: missingSpendingProfileIds } },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    for (const profile of profiles) {
      spendingProfiles.set(profile.id, profile);
    }
  }

  const lastInteraction = new Map<string, Date>();

  for (const subscription of activeSubscriptions) {
    const current = lastInteraction.get(subscription.subscriberId);
    if (!current || subscription.startsAt > current) {
      lastInteraction.set(subscription.subscriberId, subscription.startsAt);
    }
  }

  for (const transaction of recentTransactions) {
    const current = lastInteraction.get(transaction.userId);
    if (!current || transaction.createdAt > current) {
      lastInteraction.set(transaction.userId, transaction.createdAt);
    }
  }

  for (const message of recentMessages) {
    const fanId = message.senderId === profileId ? message.recipientId : message.senderId;
    if (!subscriberProfiles.has(fanId)) continue;

    const current = lastInteraction.get(fanId);
    if (!current || message.createdAt > current) {
      lastInteraction.set(fanId, message.createdAt);
    }
  }

  const topFans = spendByFan
    .map((fan) => ({
      profile: spendingProfiles.get(fan.userId),
      totalSpentCents: fan._sum.amountCents ?? 0,
      transactionCount: fan._count._all,
      tiers: Array.from(subscriberTiers.get(fan.userId) ?? []),
    }))
    .filter((fan): fan is {
      profile: AssistantProfile;
      totalSpentCents: number;
      transactionCount: number;
      tiers: string[];
    } => Boolean(fan.profile))
    .sort((a, b) => b.totalSpentCents - a.totalSpentCents)
    .slice(0, ASSISTANT_TOP_FAN_LIMIT);

  const dormantFans = Array.from(subscriberProfiles.values())
    .map((profile) => {
      const lastInteractionAt = lastInteraction.get(profile.id) ?? subscriberStarts.get(profile.id) ?? new Date(0);
      return {
        profile,
        lastInteractionAt,
        inactiveDays: daysAgo(lastInteractionAt),
        tiers: Array.from(subscriberTiers.get(profile.id) ?? []),
      };
    })
    .filter((fan) => fan.lastInteractionAt < dormantCutoff)
    .sort((a, b) => a.lastInteractionAt.getTime() - b.lastInteractionAt.getTime())
    .slice(0, ASSISTANT_DORMANT_FAN_LIMIT);

  const activityDates = [
    ...recentTransactions.map((transaction) => transaction.createdAt),
    ...recentMessages
      .filter((message) => {
        const fanId = message.senderId === profileId ? message.recipientId : message.senderId;
        return subscriberProfiles.has(fanId);
      })
      .map((message) => message.createdAt),
  ];

  return {
    topFans,
    dormantFans,
    suggestedPostTimes: buildSuggestedPostTimes(activityDates, activeSubscriptions.length),
    quickReplyTemplates: QUICK_REPLY_TEMPLATES,
  };
}

export type CreatorAssistantInsights = Awaited<ReturnType<typeof getCreatorAssistantInsights>>;

/** All amounts are stored in kobo (1/100 of a naira) — Paystack's smallest-unit convention for NGN. */
export function formatCents(cents: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(cents / 100);
}
