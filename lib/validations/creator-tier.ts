import { z } from "zod";

export const creatorTierSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().max(500),
  priceDollars: z.number().min(0, "Price can't be negative").max(10000),
  maxSubscribers: z.number().int().min(1).max(100000).nullable(),
  isLimited: z.boolean(),
  requiresApproval: z.boolean(),
});

export type CreatorTierInput = z.infer<typeof creatorTierSchema>;
