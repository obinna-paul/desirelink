import type { AccountType } from "@prisma/client";

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string; description: string }[] = [
  {
    value: "creator",
    label: "Creator",
    description: "Create exclusive photos, videos, and posts. Choose what's free and what's paid.",
  },
  {
    value: "pair",
    label: "Pair",
    description:
      "Two people exploring together — swinging, threesomes, parties, and more. You can create content too.",
  },
  {
    value: "explorer",
    label: "Explorer",
    description: "Browse, match, and connect. No pressure to create or provide anything.",
  },
  {
    value: "service_provider",
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
