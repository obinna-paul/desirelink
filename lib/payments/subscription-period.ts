export const SUBSCRIPTION_LENGTH_MONTHS = 1;

/**
 * Adds a calendar month without JavaScript's end-of-month rollover. For
 * example, a subscription started on 31 January ends on 28/29 February,
 * rather than unexpectedly rolling into March.
 */
export function getSubscriptionPeriod(start = new Date()): {
  startsAt: Date;
  endsAt: Date;
} {
  const startsAt = new Date(start);
  const endsAt = new Date(start);
  const originalDay = endsAt.getUTCDate();

  endsAt.setUTCDate(1);
  endsAt.setUTCMonth(endsAt.getUTCMonth() + SUBSCRIPTION_LENGTH_MONTHS);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(endsAt.getUTCFullYear(), endsAt.getUTCMonth() + 1, 0),
  ).getUTCDate();
  endsAt.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));

  return { startsAt, endsAt };
}
