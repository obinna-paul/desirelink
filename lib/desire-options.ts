import type { DesireLevel, PrivacyLevel } from "@prisma/client";

export const DESIRE_CATEGORIES = [
  "Casual Chat",
  "Flirting",
  "Meetups",
  "Kink Exploration",
  "ENM",
  "Couples Play",
  "Events",
  "Online Fun",
  "Friendship",
  "Creator Content",
  "Private Parties",
  "BDSM",
  "Roleplay",
  "Group Play",
  "Swinging",
  "Voyeurism",
  "Exhibitionism",
  "Fetish",
  "New Experiences",
  "Community",
] as const;

export type DesireCategory = (typeof DESIRE_CATEGORIES)[number];

export const DESIRE_LEVEL_OPTIONS: { value: DesireLevel; label: string }[] = [
  { value: "curious", label: "Curious about" },
  { value: "interested", label: "Interested in" },
  { value: "looking", label: "Looking for" },
  { value: "regular", label: "Regularly enjoy" },
  { value: "hard_limit", label: "Hard limit" },
];

export const DESIRE_LEVEL_LABELS: Record<DesireLevel, string> = {
  curious: "Curious about",
  interested: "Interested in",
  looking: "Looking for",
  regular: "Regularly enjoy",
  hard_limit: "Hard limit",
};

export const DESIRE_PRIVACY_OPTIONS: { value: PrivacyLevel; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "followers", label: "Followers" },
  { value: "private", label: "Private" },
];

export const DESIRE_PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  public: "Public",
  followers: "Followers",
  private: "Private",
};

export const DEFAULT_DESIRE_PRIVACY: PrivacyLevel = "private";
