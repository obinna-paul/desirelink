import { z } from "zod";

export const TIER_TYPE_VALUES = ["basic", "premium", "vip"] as const;

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
  requiresApproval: z.boolean(),
});

export type CreatorTierInput = z.infer<typeof creatorTierSchema>;
