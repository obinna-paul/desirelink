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

/** The small, plain-language set shown in the Preferences experience. */
export const SIMPLE_PREFERENCE_CATEGORIES = [
  "Casual Chat",
  "Flirting",
  "Meetups",
  "Events",
  "Creator Content",
  "Community",
  "New Experiences",
  "Private Parties",
] as const satisfies readonly DesireCategory[];

export const PREFERENCE_LABELS: Record<DesireCategory, string> = {
  "Casual Chat": "Conversation",
  Flirting: "Flirting",
  Meetups: "Meetups",
  "Kink Exploration": "Exploration",
  ENM: "Open connections",
  "Couples Play": "Shared experiences",
  Events: "Events",
  "Online Fun": "Online connection",
  Friendship: "Friendship",
  "Creator Content": "Creator content",
  "Private Parties": "Private plans",
  BDSM: "Structured intimacy",
  Roleplay: "Playful scenarios",
  "Group Play": "Group experiences",
  Swinging: "Open social experiences",
  Voyeurism: "Visual chemistry",
  Exhibitionism: "Being seen",
  Fetish: "Specific interests",
  "New Experiences": "New experiences",
  Community: "Community",
};

export const PREFERENCE_DESCRIPTIONS: Record<DesireCategory, string> = {
  "Casual Chat": "Easy conversation and relaxed check-ins.",
  Flirting: "Playful attention and light chemistry.",
  Meetups: "Plans that can move from online to in person.",
  "Kink Exploration": "Curiosity, trust, and careful discovery.",
  ENM: "Open relationship styles and honest arrangements.",
  "Couples Play": "Shared experiences with a partner or pair.",
  Events: "Parties, hosted plans, and things happening nearby.",
  "Online Fun": "Digital-first connection and private online moments.",
  Friendship: "Warm, low-pressure social connection.",
  "Creator Content": "Creators, subscriptions, and exclusive posts.",
  "Private Parties": "Invite-only gatherings and private social plans.",
  BDSM: "Structured intimacy with consent and clarity.",
  Roleplay: "Imaginative play and character-driven moments.",
  "Group Play": "Multi-person social or intimate settings.",
  Swinging: "Open social experiences for couples and groups.",
  Voyeurism: "Visual chemistry and watching-focused interests.",
  Exhibitionism: "Being seen in a consensual setting.",
  Fetish: "Specific tastes or interests that matter to you.",
  "New Experiences": "Trying something new with the right people.",
  Community: "Rooms, circles, and topic-led spaces.",
};

export const PREFERENCE_GROUPS: {
  id: string;
  label: string;
  description: string;
  categories: DesireCategory[];
}[] = [
  {
    id: "social",
    label: "Social",
    description: "Conversation, friendship, and easy chemistry.",
    categories: ["Casual Chat", "Friendship", "Flirting", "Online Fun"],
  },
  {
    id: "plans",
    label: "Plans",
    description: "Things to do, places to go, and private gatherings.",
    categories: ["Meetups", "Events", "Private Parties", "Community"],
  },
  {
    id: "content",
    label: "Content",
    description: "Creators, exclusive posts, and digital experiences.",
    categories: ["Creator Content", "New Experiences"],
  },
  {
    id: "exploration",
    label: "Exploration",
    description: "More specific interests, shown with softer wording.",
    categories: [
      "Kink Exploration",
      "ENM",
      "Couples Play",
      "BDSM",
      "Roleplay",
      "Group Play",
      "Swinging",
      "Voyeurism",
      "Exhibitionism",
      "Fetish",
    ],
  },
];

export function getPreferenceLabel(category: string): string {
  return PREFERENCE_LABELS[category as DesireCategory] ?? category;
}

export function getPreferenceDescription(category: string): string {
  return PREFERENCE_DESCRIPTIONS[category as DesireCategory] ?? "A private preference used to improve recommendations.";
}

export const DESIRE_LEVEL_OPTIONS: { value: DesireLevel; label: string }[] = [
  { value: "curious", label: "Open to" },
  { value: "interested", label: "Interested" },
  { value: "looking", label: "Looking for" },
  { value: "regular", label: "Usually enjoy" },
  { value: "hard_limit", label: "Avoid" },
];

export const DESIRE_LEVEL_LABELS: Record<DesireLevel, string> = {
  curious: "Open to",
  interested: "Interested",
  looking: "Looking for",
  regular: "Usually enjoy",
  hard_limit: "Avoid",
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
