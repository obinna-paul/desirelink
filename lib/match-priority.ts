export const MATCH_PRIORITY_VALUES = ["BALANCED", "SPARK", "PARTNERSHIP"] as const;

export type MatchPriorityValue = (typeof MATCH_PRIORITY_VALUES)[number];

export const MATCH_PRIORITY_OPTIONS = [
  {
    value: "BALANCED",
    label: "Show me both",
    shortLabel: "Balanced",
    description: "A mix of chemistry, compatibility and real-world timing.",
  },
  {
    value: "SPARK",
    label: "Good chemistry",
    shortLabel: "Good chemistry",
    description: "Prioritise attraction, energy and people likely to catch your eye.",
  },
  {
    value: "PARTNERSHIP",
    label: "Something real",
    shortLabel: "Something real",
    description: "Prioritise steadiness, trust and people more likely to work long-term.",
  },
] as const satisfies readonly {
  value: MatchPriorityValue;
  label: string;
  shortLabel: string;
  description: string;
}[];

export function isMatchPriorityValue(value: unknown): value is MatchPriorityValue {
  return typeof value === "string" && MATCH_PRIORITY_VALUES.includes(value as MatchPriorityValue);
}

export function normalizeMatchPriority(value: unknown): MatchPriorityValue {
  return isMatchPriorityValue(value) ? value : "BALANCED";
}
