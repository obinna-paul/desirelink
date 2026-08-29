import type { DesireLevel } from "@prisma/client";

import { getPreferenceLabel } from "@/lib/desire-options";

export const DESIRE_LEVEL_WEIGHT: Record<DesireLevel, number> = {
  curious: 3,
  interested: 6,
  looking: 14,
  regular: 12,
  hard_limit: 0,
};

export type DesireScoreInput = {
  category: string;
  level: DesireLevel;
};

export function scoreDesireOverlap(
  viewerDesires: DesireScoreInput[],
  candidateDesires: DesireScoreInput[]
): { score: number; reasons: string[] } {
  const viewerDesiresByCategory = new Map(viewerDesires.map((desire) => [desire.category, desire.level]));
  const viewerHardLimits = new Set(
    viewerDesires
      .filter((desire) => desire.level === "hard_limit")
      .map((desire) => desire.category)
  );

  let rawScore = 0;
  let highIntentOverlap = 0;
  const matchedCategories: string[] = [];

  for (const desire of candidateDesires) {
    const viewerLevel = viewerDesiresByCategory.get(desire.category);
    if (!viewerLevel) continue;

    if (viewerLevel === "hard_limit" || desire.level === "hard_limit") {
      rawScore -= 10;
      continue;
    }

    rawScore += DESIRE_LEVEL_WEIGHT[viewerLevel] + DESIRE_LEVEL_WEIGHT[desire.level];
    matchedCategories.push(desire.category);

    if (
      viewerLevel === "looking" ||
      viewerLevel === "regular" ||
      desire.level === "looking" ||
      desire.level === "regular"
    ) {
      highIntentOverlap += 1;
    }
  }

  for (const desire of candidateDesires) {
    if (viewerHardLimits.has(desire.category) && desire.level !== "hard_limit") {
      rawScore -= 8;
    }
  }

  const score = Math.max(0, Math.min(55, rawScore));
  const matchedPreferenceLabels = matchedCategories.slice(0, 2).map(getPreferenceLabel);
  const reasons =
    matchedCategories.length > 0
      ? [
          `${matchedPreferenceLabels.join(", ")} ${
            highIntentOverlap > 0 ? "aligns strongly" : "overlaps"
          } in your preferences`,
        ]
      : [];

  return { score, reasons };
}
