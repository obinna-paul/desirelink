import { z } from "zod";

import { DESIRE_CATEGORIES } from "@/lib/desire-options";

export const desireLevelSchema = z.enum([
  "curious",
  "interested",
  "looking",
  "regular",
  "hard_limit",
]);

export const privacyLevelSchema = z.enum(["public", "followers", "private"]);

export const desireEntrySchema = z.object({
  category: z.enum(DESIRE_CATEGORIES),
  level: desireLevelSchema,
  privacy: privacyLevelSchema.default("private"),
});

export const saveDesiresSchema = z.object({
  desires: z.array(desireEntrySchema).max(DESIRE_CATEGORIES.length),
});

export type DesireEntryInput = z.infer<typeof desireEntrySchema>;
export type SaveDesiresInput = z.infer<typeof saveDesiresSchema>;
