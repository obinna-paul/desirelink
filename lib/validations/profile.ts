import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(50),
  bio: z.string().max(500, "Bio must be 500 characters or fewer"),
  avatarUrl: z.string(),
  gender: z.string().min(1, "Select a gender"),
  orientation: z.string().min(1, "Select an orientation"),
  city: z.string().max(100),
  country: z.string().max(100),
  isCreator: z.boolean(),
  isCouple: z.boolean(),
  isVerified: z.boolean(),
  openToChat: z.boolean(),
  openToMeet: z.boolean(),
  showInSearch: z.boolean(),
  showExactLocation: z.boolean(),
  isIncognito: z.boolean(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
