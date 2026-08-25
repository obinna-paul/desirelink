import { z } from "zod";

export const TIER_TYPE_VALUES = ["basic", "premium", "vip"] as const;

/** Providers (Creators, Pairs, Service Providers) can charge $5-$10/month for any tier. */
export const MIN_TIER_PRICE_CENTS = 500;
export const MAX_TIER_PRICE_CENTS = 1000;
export const DEFAULT_TIER_PRICE_CENTS = 700;

const minPriceDollars = MIN_TIER_PRICE_CENTS / 100;
const maxPriceDollars = MAX_TIER_PRICE_CENTS / 100;

export const creatorTierSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().max(500),
  priceDollars: z
    .number()
    .min(minPriceDollars, `Tier price must be at least $${minPriceDollars.toFixed(2)}`)
    .max(maxPriceDollars, `Tier price can't exceed $${maxPriceDollars.toFixed(2)}`),
  tierType: z.enum(TIER_TYPE_VALUES),
  maxSubscribers: z.number().int().min(1).max(100000).nullable(),
  isLimited: z.boolean(),
  requiresApproval: z.boolean(),
});

export type CreatorTierInput = z.infer<typeof creatorTierSchema>;
