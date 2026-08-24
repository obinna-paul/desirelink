import { z } from "zod";

import { DESIRE_CATEGORIES } from "@/lib/desire-options";
import type { ProfileFieldName } from "@/lib/circles";

const profileFieldNameSchema: z.ZodType<ProfileFieldName> = z.enum([
  "bio",
  "location",
  "identity",
  "availability",
]);

const desireCategorySchema = z.enum(DESIRE_CATEGORIES as unknown as [string, ...string[]]);

export const circleVisibilitySchema = z.object({
  profileFields: z.array(profileFieldNameSchema).default([]),
  desireCategories: z.array(desireCategorySchema).default([]),
});

export const createCircleSchema = circleVisibilitySchema.extend({
  name: z.string().trim().min(2, "Circle name must be at least 2 characters").max(40),
  description: z.string().trim().max(160, "Description must be 160 characters or fewer").default(""),
});

export const updateCircleSchema = createCircleSchema;

export const addCircleMemberSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Enter a username")
    .max(50)
    .transform((value) => value.replace(/^@/, "")),
});

export type CircleVisibilityInput = z.infer<typeof circleVisibilitySchema>;
export type CreateCircleInput = z.infer<typeof createCircleSchema>;
export type UpdateCircleInput = z.infer<typeof updateCircleSchema>;
export type AddCircleMemberInput = z.infer<typeof addCircleMemberSchema>;
