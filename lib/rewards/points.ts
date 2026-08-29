import type { ProfileType } from "@prisma/client";

export const METRIC_TYPES = {
  CONTENT_VIEW: "content_view",
  MESSAGE_REPLY: "message_reply",
  PROFILE_VIEW: "profile_view",
  SUBSCRIBER_RETENTION: "subscriber_retention",
  EVENT_RSVP: "event_rsvp",
  SERVICE_VIEW: "service_view",
  SERVICE_BOOKING: "service_booking",
  COUPLE_INTEREST: "couple_interest",
} as const;

export type MetricType = (typeof METRIC_TYPES)[keyof typeof METRIC_TYPES];

export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  [METRIC_TYPES.CONTENT_VIEW]: "Content views",
  [METRIC_TYPES.MESSAGE_REPLY]: "Message replies",
  [METRIC_TYPES.PROFILE_VIEW]: "Profile views",
  [METRIC_TYPES.SUBSCRIBER_RETENTION]: "Fan retention",
  [METRIC_TYPES.EVENT_RSVP]: "Event RSVPs",
  [METRIC_TYPES.SERVICE_VIEW]: "Service views",
  [METRIC_TYPES.SERVICE_BOOKING]: "Service bookings",
  [METRIC_TYPES.COUPLE_INTEREST]: "Couple interest signals",
};

type PointWeights = Partial<Record<MetricType, number>>;

const CREATOR_POINT_WEIGHTS: PointWeights = {
  [METRIC_TYPES.CONTENT_VIEW]: 1,
  [METRIC_TYPES.MESSAGE_REPLY]: 5,
  [METRIC_TYPES.PROFILE_VIEW]: 2,
  [METRIC_TYPES.SUBSCRIBER_RETENTION]: 10,
  [METRIC_TYPES.EVENT_RSVP]: 3,
};

const PAIR_POINT_WEIGHTS: PointWeights = {
  ...CREATOR_POINT_WEIGHTS,
  [METRIC_TYPES.COUPLE_INTEREST]: 4,
};

const SERVICE_PROVIDER_POINT_WEIGHTS: PointWeights = {
  [METRIC_TYPES.SERVICE_VIEW]: 2,
  [METRIC_TYPES.SERVICE_BOOKING]: 15,
  [METRIC_TYPES.MESSAGE_REPLY]: 5,
  [METRIC_TYPES.PROFILE_VIEW]: 2,
  [METRIC_TYPES.SUBSCRIBER_RETENTION]: 10,
};

const POINT_WEIGHTS_BY_PROVIDER_TYPE: Partial<Record<ProfileType, PointWeights>> = {
  EXPLORER: CREATOR_POINT_WEIGHTS,
  CREATOR: CREATOR_POINT_WEIGHTS,
  PAIR: PAIR_POINT_WEIGHTS,
  SERVICE_PROVIDER: SERVICE_PROVIDER_POINT_WEIGHTS,
};

/** Points a single metric type is worth for a given provider type, or 0 if that type doesn't earn from it. */
export function pointWeight(metricType: string, providerType: ProfileType): number {
  const weights = POINT_WEIGHTS_BY_PROVIDER_TYPE[providerType];
  return weights?.[metricType as MetricType] ?? 0;
}

export type EngagementMetricLike = { metricType: string; value: number };

export function calculatePoints(metrics: EngagementMetricLike[], providerType: ProfileType): number {
  return metrics.reduce((total, metric) => total + pointWeight(metric.metricType, providerType) * metric.value, 0);
}

/** Points broken down by metric type, for dashboard display. */
export function calculatePointsBreakdown(
  metrics: EngagementMetricLike[],
  providerType: ProfileType
): { metricType: MetricType; points: number }[] {
  const totals = new Map<MetricType, number>();
  for (const metric of metrics) {
    const weight = pointWeight(metric.metricType, providerType);
    if (weight === 0) continue;
    totals.set(metric.metricType as MetricType, (totals.get(metric.metricType as MetricType) ?? 0) + weight * metric.value);
  }
  return Array.from(totals.entries())
    .map(([metricType, points]) => ({ metricType, points }))
    .sort((a, b) => b.points - a.points);
}

/**
 * Splits `totalPoolCents` across providers proportionally to their points.
 * Each share is floored to whole cents; any remainder from that rounding is
 * folded into the last provider's share so the full pool is always
 * distributed (never a cent left unallocated, never a cent over).
 */
export function distributePool(totalPoolCents: number, providersPoints: Map<string, number>): Map<string, number> {
  const result = new Map<string, number>();
  if (totalPoolCents <= 0) return result;

  const entries = Array.from(providersPoints.entries()).filter(([, points]) => points > 0);
  const totalPoints = entries.reduce((sum, [, points]) => sum + points, 0);
  if (totalPoints <= 0) return result;

  let distributed = 0;
  entries.forEach(([providerId, points], index) => {
    const isLast = index === entries.length - 1;
    const share = isLast ? totalPoolCents - distributed : Math.floor((points / totalPoints) * totalPoolCents);
    distributed += share;
    result.set(providerId, share);
  });

  return result;
}
