import "server-only";

import { prisma } from "@/lib/prisma";
import { isPremiumUser } from "@/lib/premium";
import { METRIC_TYPES } from "./points";

async function recordEngagement(providerId: string, userId: string, metricType: string): Promise<void> {
  if (providerId === userId) return;
  await prisma.engagementMetric.create({ data: { providerId, userId, metricType, value: 1 } });
}

/** Engagement metrics only count points when they come from a premium user (see METRIC_TYPES / points.ts). */
async function recordPremiumEngagement(providerId: string, userId: string, metricType: string): Promise<void> {
  if (!(await isPremiumUser(userId))) return;
  await recordEngagement(providerId, userId, metricType);
}

export function trackContentView(providerId: string, userId: string): Promise<void> {
  return recordPremiumEngagement(providerId, userId, METRIC_TYPES.CONTENT_VIEW);
}

export function trackMessageReply(providerId: string, userId: string): Promise<void> {
  return recordPremiumEngagement(providerId, userId, METRIC_TYPES.MESSAGE_REPLY);
}

export function trackProfileView(providerId: string, userId: string): Promise<void> {
  return recordPremiumEngagement(providerId, userId, METRIC_TYPES.PROFILE_VIEW);
}

export function trackEventRsvp(providerId: string, userId: string): Promise<void> {
  return recordPremiumEngagement(providerId, userId, METRIC_TYPES.EVENT_RSVP);
}

export function trackServiceView(providerId: string, userId: string): Promise<void> {
  return recordPremiumEngagement(providerId, userId, METRIC_TYPES.SERVICE_VIEW);
}

export function trackServiceBooking(providerId: string, userId: string): Promise<void> {
  return recordPremiumEngagement(providerId, userId, METRIC_TYPES.SERVICE_BOOKING);
}

export function trackCoupleInterest(providerId: string, userId: string): Promise<void> {
  return recordPremiumEngagement(providerId, userId, METRIC_TYPES.COUPLE_INTEREST);
}

/**
 * Subscriber retention isn't "engagement from a premium user" like the other
 * metrics — it's a per-subscriber credit for keeping them around, regardless
 * of whether that subscriber also holds Udala Premium. It's recorded once per
 * active subscriber, not gated by isPremiumUser.
 */
export function trackSubscriberRetention(providerId: string, subscriberId: string): Promise<void> {
  return recordEngagement(providerId, subscriberId, METRIC_TYPES.SUBSCRIBER_RETENTION);
}

/**
 * Snapshots subscriber retention for every provider with at least one active
 * subscriber, crediting one retention metric per active subscriber. Meant to
 * run on the 1st of each month — see app/api/cron/monthly-rewards/route.ts,
 * which runs this for the new month before it distributes the pool for the
 * month that just ended (so this month's retention feeds next month's payout).
 */
export async function recordMonthStartRetentionSnapshot(): Promise<void> {
  const now = new Date();

  const [tierSubs, legacySubs] = await Promise.all([
    prisma.providerSubscription.findMany({
      where: { status: "active", endsAt: { gt: now } },
      select: { providerId: true, subscriberId: true },
    }),
    prisma.subscription.findMany({
      where: { status: "active", endsAt: { gt: now } },
      select: { creatorId: true, subscriberId: true },
    }),
  ]);

  const pairs = [
    ...tierSubs.map((sub) => ({ providerId: sub.providerId, subscriberId: sub.subscriberId })),
    ...legacySubs.map((sub) => ({ providerId: sub.creatorId, subscriberId: sub.subscriberId })),
  ];

  await Promise.all(pairs.map((pair) => trackSubscriberRetention(pair.providerId, pair.subscriberId)));
}
