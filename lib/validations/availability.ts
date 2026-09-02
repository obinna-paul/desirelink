import { z } from "zod";

export const setAvailabilitySchema = z.object({
  status: z.enum([
    "available_tonight",
    "out_tonight",
    "open_to_meeting",
    "chatting_only",
    "couple_looking",
  ]),
  durationHours: z.number().int().min(1).max(48).default(12),
});

export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
