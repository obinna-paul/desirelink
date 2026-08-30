import { z } from "zod";

export const TIER_TYPE_VALUES = ["basic", "premium", "vip"] as const;

/** Providers (Creators, Pairs, Service Providers) can charge ₦7,500-₦15,000/month for any tier. Amounts are in kobo. */
export const MIN_TIER_PRICE_CENTS = 750_000;
export const MAX_TIER_PRICE_CENTS = 1_500_000;
export const DEFAULT_TIER_PRICE_CENTS = 1_050_000;

const minPriceNaira = MIN_TIER_PRICE_CENTS / 100;
const maxPriceNaira = MAX_TIER_PRICE_CENTS / 100;

export const creatorTierSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().max(500),
  priceNaira: z
    .number()
    .min(minPriceNaira, `Tier price must be at least ₦${minPriceNaira.toFixed(2)}`)
    .max(maxPriceNaira, `Tier price can't exceed ₦${maxPriceNaira.toFixed(2)}`),
  tierType: z.enum(TIER_TYPE_VALUES),
  maxSubscribers: z.number().int().min(1).max(100000).nullable(),
  isLimited: z.boolean(),
  requiresApproval: z.boolean(),
});

export type CreatorTierInput = z.infer<typeof creatorTierSchema>;
