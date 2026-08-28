import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";

/** Fixed at $5/month regardless of the subscriber's country or card currency. */
export const PREMIUM_SUBSCRIPTION_PRICE_CENTS = 500;
export const FREE_DAILY_MESSAGE_LIMIT = 10;
export const FREE_DAILY_PROVIDER_POST_LIMIT = 5;
export const FREE_PUBLIC_ROOM_LIMIT = 3;

export const PROVIDER_POST_VIEW_METRIC_PREFIX = "provider_post_view:";
export const PROFILE_VISITOR_METRIC_TYPE = "visitor_profile_view";

const PREMIUM_LENGTH_MONTHS = 1;
const profileViewerInclude = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      city: true,
      country: true,
      profileType: true,
      isVerified: true,
      isTrustedMember: true,
    },
  },
} satisfies Prisma.EngagementMetricInclude;

type ProfileViewerMetric = Prisma.EngagementMetricGetPayload<{
  include: typeof profileViewerInclude;
}>;

function isMissingEngagementMetricSchema(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022") &&
    String(error.meta?.table ?? error.meta?.column ?? "").includes("EngagementMetric")
  );
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function isPremiumUser(profileId: string): Promise<boolean> {
  const premium = await prisma.premiumSubscription.findUnique({
    where: { userId: profileId },
    select: { status: true, currentPeriodEnd: true },
  });
  return Boolean(premium && premium.status === "active" && premium.currentPeriodEnd > new Date());
}

export type PremiumEntitlement = {
  isPremium: boolean;
  adFree: boolean;
  benefits: string[];
};

export const PREMIUM_REWARDS_BENEFIT =
  "Your subscription supports Creators, Pairs, and Service Providers — 70% goes to them";

export async function getPremiumEntitlement(profileId: string): Promise<PremiumEntitlement> {
  const isPremium = await isPremiumUser(profileId);
  return {
    isPremium,
    adFree: isPremium,
    benefits: [
      "Unlimited messages",
      "Unlimited free provider content",
      "Unlimited public rooms",
      "Priority event RSVPs",
      "Incognito mode",
      "Advanced search filters",
      "See who viewed your profile",
      "Ad-free experience",
      PREMIUM_REWARDS_BENEFIT,
    ],
  };
}

export type PremiumLimitFeature =
  | "messaging"
  | "provider_content"
  | "public_rooms"
  | "incognito"
  | "advanced_search"
  | "profile_viewers";

export type PremiumLimitPayload = {
  error: string;
  code: "PREMIUM_REQUIRED";
  feature: PremiumLimitFeature;
  limit?: number;
  used?: number;
  remaining?: number;
};

export function premiumLimitPayload(
  feature: PremiumLimitFeature,
  error: string,
  usage?: { limit: number; used: number }
): PremiumLimitPayload {
  return {
    error,
    code: "PREMIUM_REQUIRED",
    feature,
    ...(usage
      ? {
          limit: usage.limit,
          used: usage.used,
          remaining: Math.max(0, usage.limit - usage.used),
        }
      : {}),
  };
}

export async function getDailyMessageUsage(profileId: string) {
  const since = startOfToday();
  const [directMessages, groupMessages] = await Promise.all([
    prisma.message.count({ where: { senderId: profileId, createdAt: { gte: since } } }),
    prisma.groupMessage.count({ where: { senderId: profileId, createdAt: { gte: since } } }),
  ]);
  const used = directMessages + groupMessages;
  return {
    used,
    limit: FREE_DAILY_MESSAGE_LIMIT,
    remaining: Math.max(0, FREE_DAILY_MESSAGE_LIMIT - used),
  };
}

export async function canSendMessageWithPremium(profileId: string) {
  if (await isPremiumUser(profileId)) {
    return { ok: true as const, isPremium: true as const };
  }

  const usage = await getDailyMessageUsage(profileId);
  if (usage.used >= usage.limit) {
    return {
      ok: false as const,
      status: 402,
      payload: premiumLimitPayload(
        "messaging",
        "Free accounts can send 10 messages per day. Upgrade to udala premium for unlimited messaging.",
        usage
      ),
    };
  }

  return { ok: true as const, isPremium: false as const, usage };
}

export async function getPublicRoomUsage(profileId: string) {
  const used = await prisma.roomMember.count({
    where: {
      userId: profileId,
      status: "approved",
      room: { isPrivate: false },
    },
  });

  return {
    used,
    limit: FREE_PUBLIC_ROOM_LIMIT,
    remaining: Math.max(0, FREE_PUBLIC_ROOM_LIMIT - used),
  };
}

export async function canJoinPublicRoomWithPremium(profileId: string) {
  if (await isPremiumUser(profileId)) {
    return { ok: true as const, isPremium: true as const };
  }

  const usage = await getPublicRoomUsage(profileId);
  if (usage.used >= usage.limit) {
    return {
      ok: false as const,
      status: 402,
      payload: premiumLimitPayload(
        "public_rooms",
        "Free accounts can join up to 3 public rooms. Upgrade to udala premium to join any public room.",
        usage
      ),
    };
  }

  return { ok: true as const, isPremium: false as const, usage };
}

export async function getDailyProviderPostUsage(profileId: string) {
  let metrics: { metricType: string }[] = [];

  try {
    metrics = await prisma.engagementMetric.findMany({
      where: {
        userId: profileId,
        metricType: { startsWith: PROVIDER_POST_VIEW_METRIC_PREFIX },
        createdAt: { gte: startOfToday() },
      },
      select: { metricType: true },
    });
  } catch (error) {
    if (!isMissingEngagementMetricSchema(error)) {
      throw error;
    }
    console.warn("Provider post usage is unavailable until EngagementMetric migrations are applied.");
  }

  const viewedPostIds = new Set(
    metrics
      .map((metric) => metric.metricType.slice(PROVIDER_POST_VIEW_METRIC_PREFIX.length))
      .filter(Boolean)
  );

  return {
    viewedPostIds,
    used: viewedPostIds.size,
    limit: FREE_DAILY_PROVIDER_POST_LIMIT,
    remaining: Math.max(0, FREE_DAILY_PROVIDER_POST_LIMIT - viewedPostIds.size),
  };
}

export async function recordProviderPostView(providerId: string, viewerProfileId: string, postId: string) {
  if (providerId === viewerProfileId) return;

  const metricType = `${PROVIDER_POST_VIEW_METRIC_PREFIX}${postId}`;
  try {
    const existing = await prisma.engagementMetric.findFirst({
      where: {
        providerId,
        userId: viewerProfileId,
        metricType,
        createdAt: { gte: startOfToday() },
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.engagementMetric.create({
        data: { providerId, userId: viewerProfileId, metricType, value: 1 },
      });
    }
  } catch (error) {
    if (!isMissingEngagementMetricSchema(error)) {
      throw error;
    }
    console.warn("Provider post view tracking is unavailable until EngagementMetric migrations are applied.");
  }
}

export async function recordProfileVisit(
  profileId: string,
  viewer: { id: string; isIncognito: boolean } | null
) {
  await prisma.profile.update({
    where: { id: profileId },
    data: { profileViews: { increment: 1 } },
  });

  if (!viewer || viewer.id === profileId) return;

  const hideViewer = viewer.isIncognito && (await isPremiumUser(viewer.id));
  try {
    await prisma.engagementMetric.create({
      data: {
        providerId: profileId,
        userId: hideViewer ? null : viewer.id,
        metricType: PROFILE_VISITOR_METRIC_TYPE,
        value: 1,
      },
    });
  } catch (error) {
    if (!isMissingEngagementMetricSchema(error)) {
      throw error;
    }
    console.warn("Profile visit tracking is unavailable until EngagementMetric migrations are applied.");
  }
}

export async function getProfileViewerList(profileId: string) {
  let visits: ProfileViewerMetric[];

  try {
    visits = await prisma.engagementMetric.findMany({
      where: {
        providerId: profileId,
        metricType: PROFILE_VISITOR_METRIC_TYPE,
        userId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: profileViewerInclude,
    });
  } catch (error) {
    if (!isMissingEngagementMetricSchema(error)) {
      throw error;
    }
    console.warn("Profile viewer list is unavailable until EngagementMetric migrations are applied.");
    return [];
  }

  const seen = new Set<string>();
  return visits
    .filter((visit) => {
      if (!visit.user || seen.has(visit.user.id)) return false;
      seen.add(visit.user.id);
      return true;
    })
    .map((visit) => ({
      id: visit.id,
      viewedAt: visit.createdAt.toISOString(),
      viewer: visit.user!,
    }));
}

/** Count of premium subscriptions active at any point during [start, end). */
export async function countActivePremiumSubscriptionsInRange(start: Date, end: Date): Promise<number> {
  return prisma.premiumSubscription.count({
    where: {
      status: { in: ["active", "cancelled"] },
      currentPeriodStart: { lt: end },
      currentPeriodEnd: { gt: start },
    },
  });
}

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

export type PremiumSubscribeResult =
  | { ok: true; state: "subscribed" }
  | { ok: true; state: "checkout"; checkoutUrl: string }
  | { ok: false; status: number; error: string };

/** Mirrors subscribeToProvider (lib/providers.ts): charges a saved card directly, or starts checkout to collect one first. */
export async function subscribeToPremium(
  profileId: string,
  urls: { successUrl: string; cancelUrl: string }
): Promise<PremiumSubscribeResult> {
  if (await isPremiumUser(profileId)) {
    return { ok: true, state: "subscribed" };
  }

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { paymentCustomerId: true },
  });
  const customerId = await getOrCreatePaymentCustomerId(profileId, profile.paymentCustomerId);
  const defaultCard = await prisma.paymentMethod.findFirst({ where: { userId: profileId, isDefault: true } });

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setMonth(endsAt.getMonth() + PREMIUM_LENGTH_MONTHS);

  if (defaultCard) {
    const { reference, success } = await paymentProvider.chargeSavedPaymentMethod(
      customerId,
      defaultCard.externalId,
      PREMIUM_SUBSCRIPTION_PRICE_CENTS,
      { kind: "premium" }
    );
    if (!success) {
      return { ok: false, status: 402, error: "Your saved card was declined. Try updating your payment method." };
    }
    await prisma.premiumSubscription.upsert({
      where: { userId: profileId },
      create: {
        userId: profileId,
        status: "active",
        paymentCustomerId: customerId,
        paymentSubscriptionId: reference,
        currentPeriodStart: startsAt,
        currentPeriodEnd: endsAt,
      },
      update: {
        status: "active",
        paymentSubscriptionId: reference,
        currentPeriodStart: startsAt,
        currentPeriodEnd: endsAt,
        cancelAtPeriodEnd: false,
        pastDueSince: null,
        paymentRetryCount: 0,
      },
    });
    await prisma.transaction.create({
      data: { userId: profileId, amountCents: PREMIUM_SUBSCRIPTION_PRICE_CENTS, status: "succeeded", provider: "card", isPremium: true },
    });
    return { ok: true, state: "subscribed" };
  }

  const pending = await prisma.premiumSubscription.upsert({
    where: { userId: profileId },
    create: { userId: profileId, status: "pending", paymentCustomerId: customerId, currentPeriodStart: startsAt, currentPeriodEnd: endsAt },
    update: { status: "pending", currentPeriodStart: startsAt, currentPeriodEnd: endsAt },
  });

  const checkoutUrl = await paymentProvider.createCheckoutSession(
    customerId,
    PREMIUM_SUBSCRIPTION_PRICE_CENTS,
    urls.successUrl,
    urls.cancelUrl,
    { kind: "premium", pendingId: pending.id }
  );

  return { ok: true, state: "checkout", checkoutUrl };
}

export type CancelPremiumResult = { ok: true } | { ok: false; status: number; error: string };

export async function cancelPremium(profileId: string): Promise<CancelPremiumResult> {
  const premium = await prisma.premiumSubscription.findUnique({ where: { userId: profileId } });
  if (!premium || premium.status !== "active") {
    return { ok: false, status: 404, error: "No active Premium subscription found" };
  }

  await prisma.premiumSubscription.update({ where: { userId: profileId }, data: { cancelAtPeriodEnd: true } });
  return { ok: true };
}
