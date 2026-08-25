import { z } from "zod";

export const subscribeToProviderSchema = z.object({
  tierId: z.string().min(1, "A tier is required"),
});
