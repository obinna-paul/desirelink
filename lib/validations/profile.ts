import { z } from "zod";

import { ACCOUNT_TYPE_VALUES } from "@/lib/validations/auth";

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(50),
  bio: z.string().max(500, "Bio must be 500 characters or fewer"),
  avatarUrl: z.string(),
  gender: z.string().min(1, "Select a gender"),
  orientation: z.string().min(1, "Select an orientation"),
  locationLat: z.number().min(-90).max(90),
  locationLng: z.number().min(-180).max(180),
  city: z.string().max(100),
  country: z.string().max(100),
  profileType: z.enum(ACCOUNT_TYPE_VALUES).optional(),
  serviceCategories: z.array(z.string()).max(10),
  isVerified: z.boolean(),
  openToChat: z.boolean(),
  openToMeet: z.boolean(),
  showInSearch: z.boolean(),
  showExactLocation: z.boolean(),
  isIncognito: z.boolean(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
