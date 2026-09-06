/** Returns a display percentage only when the comparison price is a real discount. */
export function getTierDiscountPercent(
  priceCents: number,
  compareAtPriceCents: number | null | undefined,
): number | null {
  if (!compareAtPriceCents || compareAtPriceCents <= priceCents) return null;

  return Math.max(
    1,
    Math.round(((compareAtPriceCents - priceCents) / compareAtPriceCents) * 100),
  );
}
