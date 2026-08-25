import type { ProfileType } from "@prisma/client";

export const ACCOUNT_TYPE_OPTIONS: { value: ProfileType; label: string; description: string }[] = [
  {
    value: "CREATOR",
    label: "Creator",
    description: "Create exclusive photos, videos, and posts. Choose what's free and what's paid.",
  },
  {
    value: "PAIR",
    label: "Pair",
    description:
      "Two people exploring together — swinging, threesomes, parties, and more. You can create content too.",
  },
  {
    value: "EXPLORER",
    label: "Explorer",
    description: "Browse, match, and connect. No pressure to create or provide anything.",
  },
  {
    value: "SERVICE_PROVIDER",
    label: "Service provider",
    description: "Offer sex-oriented or sensual services — escort, private chef, massage, and more.",
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
