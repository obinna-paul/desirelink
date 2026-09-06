export const INSIGHTS_RANGES = ["7d", "30d", "90d", "12mo"] as const;
export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

const RANGE_DAYS: Record<InsightsRange, number> = { "7d": 7, "30d": 30, "90d": 90, "12mo": 365 };
const BUCKET_DAYS: Record<InsightsRange, number> = { "7d": 1, "30d": 1, "90d": 7, "12mo": 30 };

function bucketLabel(date: Date, range: InsightsRange) {
  return range === "12mo"
    ? date.toLocaleDateString("en-US", { month: "short" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function buildMetricBuckets(range: InsightsRange, now = new Date()) {
  if (range === "12mo") {
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const buckets: { start: Date; end: Date; label: string }[] = [];

    for (let cursor = new Date(rangeStart); cursor < rangeEnd; cursor.setMonth(cursor.getMonth() + 1)) {
      const start = new Date(cursor);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      buckets.push({ start, end, label: bucketLabel(start, range) });
    }

    return { buckets, rangeStart, rangeEnd };
  }

  const bucketDays = BUCKET_DAYS[range];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - (RANGE_DAYS[range] - 1));
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + 1);

  const buckets: { start: Date; end: Date; label: string }[] = [];
  let cursor = new Date(rangeStart);
  while (cursor < rangeEnd) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + bucketDays);
    buckets.push({ start, end: end > rangeEnd ? rangeEnd : end, label: bucketLabel(start, range) });
    cursor = end;
  }

  return { buckets, rangeStart, rangeEnd };
}

export function getAdminTransactionSource(transaction: {
  subscriptionId?: string | null;
  providerSubscriptionId?: string | null;
  tierId?: string | null;
  serviceBookingId?: string | null;
}) {
  if (transaction.serviceBookingId) return "Service booking";
  if (transaction.subscriptionId || transaction.providerSubscriptionId || transaction.tierId) return "Subscription";
  return "Hearts purchase";
}
