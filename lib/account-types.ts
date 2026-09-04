import type { ProfileType } from "@prisma/client";

export const ACCOUNT_TYPE_OPTIONS: { value: ProfileType; label: string; description: string }[] = [
  {
    value: "EXPLORER",
    label: "Explorer",
    description:
      "Interact with creators, subscribe to their content, and patronize services. Comes with a wallet for spending hearts.",
  },
  {
    value: "CREATOR",
    label: "Creator",
    description:
      "List paid services, go live, and post exclusive photos and videos. Earn from fan subscriptions, paid requests in live streams, and hearts in DMs. Build a rating on your profile and track it all from your dashboard.",
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
