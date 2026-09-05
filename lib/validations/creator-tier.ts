import { z } from "zod";

export const TIER_TYPE_VALUES = ["beginner", "premium", "inner_circle"] as const;

export const TIER_TYPE_LABELS: Record<(typeof TIER_TYPE_VALUES)[number], string> = {
  beginner: "Beginner",
  premium: "Real fans",
  inner_circle: "Inner circle",
};

/** Amounts are in kobo. No fixed price range - creators set whatever they want. */
export const DEFAULT_TIER_PRICE_CENTS = 1_050_000;
/** Purely a ceiling to keep priceCents (a Postgres 32-bit Int) from overflowing - not a pricing rule. */
const MAX_SAFE_PRICE_NAIRA = 10_000_000;

export const creatorTierSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().max(500),
  priceNaira: z
    .number()
    .positive("Tier price must be greater than ₦0")
    .max(MAX_SAFE_PRICE_NAIRA, "Tier price is too large"),
  tierType: z.enum(TIER_TYPE_VALUES),
  maxSubscribers: z.number().int().min(1).max(100000).nullable(),
  isLimited: z.boolean(),
});

export type CreatorTierInput = z.infer<typeof creatorTierSchema>;

/**
 * Access is cumulative by price (see lib/subscription-access.ts's resolvePostAccess) - a
 * higher tier only actually unlocks a lower one if it's also priced higher. Rejects a
 * create/update that would invert that ordering against the creator's other tiers (e.g. an
 * "inner_circle" tier priced below an existing "beginner" tier), so "Inner Circle unlocks
 * everything" can never silently break just because of how a creator priced their tiers.
 */
export function findTierRankConflict(
  candidate: { tierType: (typeof TIER_TYPE_VALUES)[number]; priceCents: number },
  otherTiers: { name: string; tierType: string; priceCents: number }[],
): string | null {
  const candidateRank = TIER_TYPE_VALUES.indexOf(candidate.tierType);

  for (const other of otherTiers) {
    const otherRank = TIER_TYPE_VALUES.indexOf(other.tierType as (typeof TIER_TYPE_VALUES)[number]);
    if (otherRank === -1 || otherRank === candidateRank) continue;

    const otherLabel = TIER_TYPE_LABELS[other.tierType as keyof typeof TIER_TYPE_LABELS] ?? other.tierType;
    if (otherRank < candidateRank && other.priceCents > candidate.priceCents) {
      return `A ${TIER_TYPE_LABELS[candidate.tierType]} tier must be priced at or above "${other.name}" (${otherLabel}), so higher tiers keep unlocking lower ones.`;
    }
    if (otherRank > candidateRank && other.priceCents < candidate.priceCents) {
      return `A ${TIER_TYPE_LABELS[candidate.tierType]} tier must be priced at or below "${other.name}" (${otherLabel}), so higher tiers keep unlocking lower ones.`;
    }
  }

  return null;
}
