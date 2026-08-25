import { z } from "zod";

export const serviceListingSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(80),
  description: z.string().max(500),
  category: z.string().min(1, "Select a category"),
  durationMinutes: z.number().int().min(15, "Minimum duration is 15 minutes").max(1440),
  priceCents: z.number().int().min(0, "Price can't be negative").max(1_000_000),
});

export type ServiceListingInput = z.infer<typeof serviceListingSchema>;
