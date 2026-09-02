import type { ProfileType } from "@prisma/client";

export const ACCOUNT_TYPE_OPTIONS: { value: ProfileType; label: string; description: string }[] = [
  {
    value: "EXPLORER",
    label: "Explorer",
    description: "Browse, match, and connect. No pressure to create or provide anything.",
  },
  {
    value: "PROVIDER",
    label: "Provider",
    description:
      "Create exclusive photos, videos, and posts, and/or offer paid services — escort, private chef, massage, and more. Turn on whichever fits you.",
  },
];

export const SERVICE_CATEGORY_OPTIONS = [
  "Escort",
  "Private chef",
  "Massage therapist",
  "Companion",
  "Dominatrix / BDSM play partner",
  "Stripper / dancer",
  "Other",
];
