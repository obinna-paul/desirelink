import "server-only";

import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";

export const FREE_MESSAGE_LIMIT = 10;
export const MESSAGE_LIMIT_WINDOW_HOURS = 24;
export const MESSAGE_LIMIT_METRIC_TYPE = "message_limit_usage";

export type MessageLimitState = {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  unlimited: boolean;
  reason: "premium" | "provider" | "free";
};

export function messageLimitWindowStart() {
  return new Date(Date.now() - MESSAGE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
}

export async function checkMessageLimit(userId: string): Promise<MessageLimitState> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      profileType: true,
      premiumSubscription: { select: { status: true, currentPeriodEnd: true } },
    },
  });

  if (!profile) {
    return { allowed: false, remaining: 0, limit: FREE_MESSAGE_LIMIT, used: 0, unlimited: false, reason: "free" };
  }

  const now = new Date();
  const premium = profile.premiumSubscription;
  const isPremium = Boolean(premium && premium.status === "active" && premium.currentPeriodEnd > now);

  if (isPremium) {
    return {
      allowed: true,
      remaining: FREE_MESSAGE_LIMIT,
      limit: FREE_MESSAGE_LIMIT,
      used: 0,
      unlimited: true,
      reason: "premium",
    };
  }

  if (isProviderProfileType(profile.profileType)) {
    return {
      allowed: true,
      remaining: FREE_MESSAGE_LIMIT,
      limit: FREE_MESSAGE_LIMIT,
      used: 0,
      unlimited: true,
      reason: "provider",
    };
  }

  const used = await prisma.engagementMetric.count({
    where: {
      providerId: userId,
      userId,
      metricType: MESSAGE_LIMIT_METRIC_TYPE,
      createdAt: { gte: messageLimitWindowStart() },
    },
  });
  const remaining = Math.max(0, FREE_MESSAGE_LIMIT - used);

  return {
    allowed: remaining > 0,
    remaining,
    limit: FREE_MESSAGE_LIMIT,
    used,
    unlimited: false,
    reason: "free",
  };
}

/**
 * Message-limit usage is recorded separately from chat history so the rolling
 * window can be reset/cleaned without touching user conversations.
 */
export async function incrementMessageCount(userId: string): Promise<void> {
  await prisma.engagementMetric.create({
    data: {
      providerId: userId,
      userId,
      metricType: MESSAGE_LIMIT_METRIC_TYPE,
      value: 1,
    },
  });
}

/**
 * For a rolling 24-hour policy, reset means removing expired usage rows while
 * preserving any sends that still sit inside the window.
 */
export async function resetMessageCount(userId: string): Promise<void> {
  await prisma.engagementMetric.deleteMany({
    where: {
      providerId: userId,
      userId,
      metricType: MESSAGE_LIMIT_METRIC_TYPE,
      createdAt: { lt: messageLimitWindowStart() },
    },
  });
}
