import { z } from "zod";

export const subscribeToProviderSchema = z.object({
  tierId: z.string().min(1, "A tier is required"),
  /** The specific locked post whose "Subscribe now" button started this - see PostUnlock. */
  conversionPostId: z.string().min(1).optional(),
});
