import "server-only";

// server-only. Low-signal detectors (report §6.2: "excessive speed, straight-line letter
// selection, contradiction across matched items, or too many skipped questions. Offer a
// retake rather than false precision"). The report names these four categories but does not
// specify thresholds or a contradiction rule - the values below are an explicit engineering
// judgment call, documented for revision once real response-time/skip distributions exist
// (docs/spec-test-v2-implementation-plan.md §12 "Item analytics").

import type { SpecItemV2 } from "@/lib/spec-test/items/spec-v2";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";
import { OPTION_MOTIVE_LOADINGS, TENSION_ITEM_PAIRS } from "@/lib/spec-test/scoring/loadings";
import type { ResponseQuality, ScoringDimensionKey } from "@/lib/spec-test/taxonomy";

/** Per docs/spec-test-v2-implementation-plan.md open decision D-3: skipping is allowed
 *  (exposure normalization absorbs it cleanly), capped before the result becomes low-signal. */
export const SKIP_CAP = 3;

/** An item's prompt and four options cannot be meaningfully read and compared in under this
 *  many milliseconds - crossing it repeatedly suggests the taker isn't reading items. */
const SPEED_FLOOR_MS = 500;
/** Flag only once this many items are under the floor - one fast tap is not a pattern. */
const SPEED_FLOOR_COUNT = 5;

/** Selecting the same on-screen position on this share of answered items suggests
 *  position-based tapping rather than reading each option. */
const STRAIGHT_LINE_SHARE = 0.8;

/** Two dimensions are "opposed" when their attraction narratives pull in visibly different
 *  directions (status vs. warmth, expressive vs. private, novelty vs. reliability) - used only
 *  to flag a respondent whose answers zig-zag across every tension pair, not to penalize any
 *  single answer. See TENSION_ITEM_PAIRS in loadings.ts for which items are checked. */
const OPPOSED_DIMENSIONS: Partial<Record<ScoringDimensionKey, ScoringDimensionKey[]>> = {
  agencyDirection: ["warmthResponsiveness"],
  warmthResponsiveness: ["agencyDirection"],
  socialVitality: ["containedDepthPrivacy"],
  containedDepthPrivacy: ["socialVitality"],
  noveltyAutonomy: ["reliabilityReciprocity"],
  reliabilityReciprocity: ["noveltyAutonomy"],
};

export type QualityFlag = "too_fast" | "straight_line" | "contradiction" | "excessive_skips";

export type QualityAssessment = {
  quality: ResponseQuality;
  flags: QualityFlag[];
};

export type QualityAssessmentOptions = {
  /** v2.0/v2.1 treated the authored tension-pair heuristic as blocking. v2.2 keeps the flag
   * for analysis but no longer rejects a coherent Spark/Partnership distinction as invalid. */
  contradictionMode?: "blocking" | "diagnostic";
};

function findResponse(responses: SpecTestResponseV2[], itemId: string): SpecTestResponseV2 | undefined {
  return responses.find((response) => response.itemId === itemId);
}

function chosenDimension(itemId: string, response: SpecTestResponseV2 | undefined): ScoringDimensionKey | undefined {
  if (!response || response.skipped || !response.optionId) return undefined;
  return OPTION_MOTIVE_LOADINGS[response.optionId];
}

export function assessResponseQuality(
  items: SpecItemV2[],
  responses: SpecTestResponseV2[],
  { contradictionMode = "blocking" }: QualityAssessmentOptions = {},
): QualityAssessment {
  const flags: QualityFlag[] = [];

  const skipCount = responses.filter((response) => response.skipped || response.optionId === null).length;
  if (skipCount > SKIP_CAP) flags.push("excessive_skips");

  const answered = responses.filter((response) => !response.skipped && response.optionId !== null);

  const tooFastCount = answered.filter((response) => response.elapsedMs < SPEED_FLOOR_MS).length;
  if (tooFastCount >= SPEED_FLOOR_COUNT) flags.push("too_fast");

  const withPosition = answered.filter((response) => response.presentedIndex !== null);
  if (withPosition.length > 0) {
    const counts = new Map<number, number>();
    for (const response of withPosition) {
      const index = response.presentedIndex as number;
      counts.set(index, (counts.get(index) ?? 0) + 1);
    }
    const maxShare = Math.max(...Array.from(counts.values())) / withPosition.length;
    if (maxShare >= STRAIGHT_LINE_SHARE) flags.push("straight_line");
  }

  let opposedPairs = 0;
  for (const [itemAId, itemBId] of TENSION_ITEM_PAIRS) {
    const dimA = chosenDimension(itemAId, findResponse(responses, itemAId));
    const dimB = chosenDimension(itemBId, findResponse(responses, itemBId));
    if (!dimA || !dimB) continue;
    if (OPPOSED_DIMENSIONS[dimA]?.includes(dimB)) opposedPairs += 1;
  }
  // A single opposed pair is ordinary nuance (attraction and judgment can genuinely differ
  // once); every tension pair opposed at once reads as a coin-flip pattern instead.
  if (opposedPairs >= TENSION_ITEM_PAIRS.length && TENSION_ITEM_PAIRS.length > 0) {
    flags.push("contradiction");
  }

  const blockingFlags =
    contradictionMode === "diagnostic" ? flags.filter((flag) => flag !== "contradiction") : flags;
  const quality: ResponseQuality = blockingFlags.length > 0 ? "low_signal" : "usable";
  return { quality, flags };
}
