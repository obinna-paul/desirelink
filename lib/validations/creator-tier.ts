import { z } from "zod";

export const TIER_TYPE_VALUES = ["basic", "premium", "vip"] as const;

export const MAX_TIER_PRICE_CENTS = 1000;

export const creatorTierSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().max(500),
  priceDollars: z
    .number()
    .min(0, "Price can't be negative")
    .max(MAX_TIER_PRICE_CENTS / 100, `Tier price can't exceed $${(MAX_TIER_PRICE_CENTS / 100).toFixed(2)}`),
  tierType: z.enum(TIER_TYPE_VALUES),
  maxSubscribers: z.number().int().min(1).max(100000).nullable(),
  isLimited: z.boolean(),
  requiresApproval: z.boolean(),
});

export type CreatorTierInput = z.infer<typeof creatorTierSchema>;
