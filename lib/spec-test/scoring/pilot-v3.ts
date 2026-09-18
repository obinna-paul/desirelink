import "server-only";

// Provisional v3 research scoring. This deliberately produces motive evidence, not a branded
// archetype: prototypes and decision boundaries must be fitted on development data and then
// frozen before the pilot can become a live instrument.

import {
  SPEC_TEST_ITEMS_V3_PILOT,
  type BestWorstItemV3,
  type SpecItemV3Pilot,
} from "@/lib/spec-test/items/spec-v3-pilot";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import {
  ATTACHMENT_RESPONSE_LABELS,
  SCORING_DIMENSION_KEYS,
  type AttachmentResponseLabel,
  type ScoringDimensionKey,
} from "@/lib/spec-test/taxonomy";

type DimensionBlock = readonly [
  ScoringDimensionKey,
  ScoringDimensionKey,
  ScoringDimensionKey,
  ScoringDimensionKey,
];

/** Canonical option order -> dimension. Kept server-only so the browser never receives what
 * an individual answer measures. The 14 unique blocks form a balanced 2-(8,4,3) design; the
 * final complementary pair raises every dimension from seven to eight appearances. */
export const V3_PILOT_BLOCK_DIMENSIONS: Record<string, DimensionBlock> = {
  "v3-room-presence": ["warmthResponsiveness", "socialVitality", "cognitivePlay", "containedDepthPrivacy"],
  "v3-first-plan": ["reliabilityReciprocity", "agencyDirection", "noveltyAutonomy", "aestheticSelectivity"],
  "v3-feeling-seen": ["warmthResponsiveness", "reliabilityReciprocity", "cognitivePlay", "noveltyAutonomy"],
  "v3-quiet-confidence": ["socialVitality", "agencyDirection", "containedDepthPrivacy", "aestheticSelectivity"],
  "v3-good-news": ["warmthResponsiveness", "reliabilityReciprocity", "socialVitality", "agencyDirection"],
  "v3-weekend-window": ["cognitivePlay", "noveltyAutonomy", "containedDepthPrivacy", "aestheticSelectivity"],
  "v3-unexpected-change": ["warmthResponsiveness", "agencyDirection", "cognitivePlay", "aestheticSelectivity"],
  "v3-growing-trust": ["reliabilityReciprocity", "socialVitality", "noveltyAutonomy", "containedDepthPrivacy"],
  "v3-date-memory": ["warmthResponsiveness", "socialVitality", "noveltyAutonomy", "aestheticSelectivity"],
  "v3-respect-moment": ["agencyDirection", "cognitivePlay", "containedDepthPrivacy", "reliabilityReciprocity"],
  "v3-closeness-signal": ["warmthResponsiveness", "reliabilityReciprocity", "containedDepthPrivacy", "aestheticSelectivity"],
  "v3-shared-momentum": ["socialVitality", "agencyDirection", "cognitivePlay", "noveltyAutonomy"],
  "v3-hard-conversation": ["warmthResponsiveness", "agencyDirection", "noveltyAutonomy", "containedDepthPrivacy"],
  "v3-easy-afternoon": ["reliabilityReciprocity", "socialVitality", "cognitivePlay", "aestheticSelectivity"],
  "v3-second-look": ["warmthResponsiveness", "socialVitality", "cognitivePlay", "containedDepthPrivacy"],
  "v3-future-glimpse": ["reliabilityReciprocity", "agencyDirection", "noveltyAutonomy", "aestheticSelectivity"],
};

export const V3_PILOT_INTENSITY_DIMENSIONS: Record<string, ScoringDimensionKey> = {
  "v3-intensity-warmth": "warmthResponsiveness",
  "v3-intensity-reliability": "reliabilityReciprocity",
  "v3-intensity-vitality": "socialVitality",
  "v3-intensity-agency": "agencyDirection",
  "v3-intensity-cognitive": "cognitivePlay",
  "v3-intensity-novelty": "noveltyAutonomy",
  "v3-intensity-depth": "containedDepthPrivacy",
  "v3-intensity-aesthetic": "aestheticSelectivity",
};

export const V3_PILOT_UNCERTAINTY_LOADINGS: Record<string, AttachmentResponseLabel> = {
  "v3-uncertainty-reply-a": "reassuranceSensitive",
  "v3-uncertainty-reply-b": "steadyUnderUncertainty",
  "v3-uncertainty-reply-c": "spaceProtective",
  "v3-uncertainty-reply-d": "pushPull",
  "v3-uncertainty-closeness-a": "steadyUnderUncertainty",
  "v3-uncertainty-closeness-b": "reassuranceSensitive",
  "v3-uncertainty-closeness-c": "spaceProtective",
  "v3-uncertainty-closeness-d": "pushPull",
  "v3-uncertainty-conflict-a": "steadyUnderUncertainty",
  "v3-uncertainty-conflict-b": "reassuranceSensitive",
  "v3-uncertainty-conflict-c": "spaceProtective",
  "v3-uncertainty-conflict-d": "pushPull",
  "v3-uncertainty-support-a": "steadyUnderUncertainty",
  "v3-uncertainty-support-b": "reassuranceSensitive",
  "v3-uncertainty-support-c": "spaceProtective",
  "v3-uncertainty-support-d": "pushPull",
};

export type V3PilotBankDiagnostics = {
  itemCounts: { bestWorst: number; intensity: number; uncertainty: number; total: number };
  dimensionExposure: Record<ScoringDimensionKey, number>;
  pairExposure: Record<string, number>;
  minPairExposure: number;
  maxPairExposure: number;
};

export type V3PilotDimensionScore = {
  comparativeRaw: number;
  comparativeExposure: number;
  comparativeScore: number | null;
  intensityScore: number | null;
  /** Transparent provisional composite in [-1, 1], never a calibrated probability. */
  combinedScore: number | null;
};

export type V3PilotAttractionProfile = Record<ScoringDimensionKey, V3PilotDimensionScore>;

function emptyDimensionRecord<T>(factory: () => T): Record<ScoringDimensionKey, T> {
  return Object.fromEntries(SCORING_DIMENSION_KEYS.map((dimension) => [dimension, factory()])) as Record<
    ScoringDimensionKey,
    T
  >;
}

function pairKey(a: ScoringDimensionKey, b: ScoringDimensionKey): string {
  return [a, b].sort().join("::");
}

export function analyzeV3PilotBank(items: SpecItemV3Pilot[] = SPEC_TEST_ITEMS_V3_PILOT): V3PilotBankDiagnostics {
  const bestWorst = items.filter((item): item is BestWorstItemV3 => item.kind === "best_worst");
  const dimensionExposure = emptyDimensionRecord(() => 0);
  const pairExposure: Record<string, number> = {};

  for (const item of bestWorst) {
    const dimensions = V3_PILOT_BLOCK_DIMENSIONS[item.id];
    if (!dimensions) continue;
    for (const dimension of dimensions) dimensionExposure[dimension] += 1;
    for (let left = 0; left < dimensions.length; left += 1) {
      for (let right = left + 1; right < dimensions.length; right += 1) {
        const key = pairKey(dimensions[left], dimensions[right]);
        pairExposure[key] = (pairExposure[key] ?? 0) + 1;
      }
    }
  }

  const pairCounts = Object.values(pairExposure);
  return {
    itemCounts: {
      bestWorst: bestWorst.length,
      intensity: items.filter((item) => item.kind === "intensity").length,
      uncertainty: items.filter((item) => item.kind === "single_choice").length,
      total: items.length,
    },
    dimensionExposure,
    pairExposure,
    minPairExposure: pairCounts.length > 0 ? Math.min(...pairCounts) : 0,
    maxPairExposure: pairCounts.length > 0 ? Math.max(...pairCounts) : 0,
  };
}

export function validateV3PilotResponses(
  items: SpecItemV3Pilot[],
  responses: SpecTestResponseV3[],
  options: { requireComplete?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const validPresentedIndex = (value: number | null) =>
    value !== null && Number.isInteger(value) && value >= 0 && value <= 3;

  for (const response of responses) {
    const item = itemsById.get(response.itemId);
    if (!item) {
      errors.push(`unknown_item:${response.itemId}`);
      continue;
    }
    if (seen.has(response.itemId)) errors.push(`duplicate_response:${response.itemId}`);
    seen.add(response.itemId);
    if (item.kind !== response.kind) {
      errors.push(`kind_mismatch:${response.itemId}`);
      continue;
    }
    if (response.elapsedMs < 0 || !Number.isFinite(response.elapsedMs)) {
      errors.push(`invalid_elapsed_ms:${response.itemId}`);
    }
    if (response.skipped) {
      if (
        (response.kind === "best_worst" &&
          (response.bestOptionId !== null ||
            response.worstOptionId !== null ||
            response.bestPresentedIndex !== null ||
            response.worstPresentedIndex !== null)) ||
        (response.kind === "intensity" && response.rating !== null) ||
        (response.kind === "single_choice" &&
          (response.optionId !== null || response.presentedIndex !== null))
      ) {
        errors.push(`invalid_skip:${response.itemId}`);
      }
      continue;
    }

    if (item.kind === "best_worst" && response.kind === "best_worst") {
      const optionIds = new Set(item.options.map((option) => option.id));
      if (!response.bestOptionId || !optionIds.has(response.bestOptionId)) errors.push(`invalid_best:${item.id}`);
      if (!response.worstOptionId || !optionIds.has(response.worstOptionId)) errors.push(`invalid_worst:${item.id}`);
      if (response.bestOptionId && response.bestOptionId === response.worstOptionId) {
        errors.push(`same_best_worst:${item.id}`);
      }
      if (!validPresentedIndex(response.bestPresentedIndex)) errors.push(`invalid_best_position:${item.id}`);
      if (!validPresentedIndex(response.worstPresentedIndex)) errors.push(`invalid_worst_position:${item.id}`);
      if (response.bestPresentedIndex === response.worstPresentedIndex) {
        errors.push(`same_best_worst_position:${item.id}`);
      }
    } else if (item.kind === "intensity" && response.kind === "intensity") {
      if (response.rating === null || !Number.isInteger(response.rating) || response.rating < 1 || response.rating > 7) {
        errors.push(`invalid_rating:${item.id}`);
      }
    } else if (item.kind === "single_choice" && response.kind === "single_choice") {
      const optionIds = new Set(item.options.map((option) => option.id));
      if (!response.optionId || !optionIds.has(response.optionId)) errors.push(`invalid_option:${item.id}`);
      if (!validPresentedIndex(response.presentedIndex)) errors.push(`invalid_position:${item.id}`);
    }
  }

  if (options.requireComplete) {
    for (const item of items) {
      if (!seen.has(item.id)) errors.push(`missing_response:${item.id}`);
    }
  }
  return errors;
}

export function scoreV3PilotAttraction(
  items: SpecItemV3Pilot[],
  responses: SpecTestResponseV3[],
): V3PilotAttractionProfile {
  const validationErrors = validateV3PilotResponses(items, responses);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid v3 pilot responses: ${validationErrors.join(", ")}`);
  }

  const comparativeRaw = emptyDimensionRecord(() => 0);
  const comparativeExposure = emptyDimensionRecord(() => 0);
  const intensityScore = emptyDimensionRecord<number | null>(() => null);
  const itemsById = new Map(items.map((item) => [item.id, item]));

  for (const response of responses) {
    if (response.skipped) continue;
    const item = itemsById.get(response.itemId);
    if (!item || item.kind !== response.kind) continue;

    if (item.kind === "best_worst" && response.kind === "best_worst") {
      const dimensions = V3_PILOT_BLOCK_DIMENSIONS[item.id];
      if (!dimensions || !response.bestOptionId || !response.worstOptionId) continue;
      for (const dimension of dimensions) comparativeExposure[dimension] += 1;
      const bestIndex = item.options.findIndex((option) => option.id === response.bestOptionId);
      const worstIndex = item.options.findIndex((option) => option.id === response.worstOptionId);
      comparativeRaw[dimensions[bestIndex]] += 1;
      comparativeRaw[dimensions[worstIndex]] -= 1;
    }

    if (item.kind === "intensity" && response.kind === "intensity" && response.rating !== null) {
      const dimension = V3_PILOT_INTENSITY_DIMENSIONS[item.id];
      if (dimension) intensityScore[dimension] = (response.rating - 4) / 3;
    }
  }

  return Object.fromEntries(
    SCORING_DIMENSION_KEYS.map((dimension) => {
      const comparativeScore =
        comparativeExposure[dimension] > 0 ? comparativeRaw[dimension] / comparativeExposure[dimension] : null;
      const intensity = intensityScore[dimension];
      const available = [comparativeScore, intensity].filter((value): value is number => value !== null);
      return [
        dimension,
        {
          comparativeRaw: comparativeRaw[dimension],
          comparativeExposure: comparativeExposure[dimension],
          comparativeScore,
          intensityScore: intensity,
          combinedScore:
            available.length > 0 ? available.reduce((sum, value) => sum + value, 0) / available.length : null,
        },
      ];
    }),
  ) as V3PilotAttractionProfile;
}

export function scoreV3PilotUncertainty(
  items: SpecItemV3Pilot[],
  responses: SpecTestResponseV3[],
): Record<AttachmentResponseLabel, number> {
  const counts = Object.fromEntries(ATTACHMENT_RESPONSE_LABELS.map((label) => [label, 0])) as Record<
    AttachmentResponseLabel,
    number
  >;
  const validOptionIds = new Set(
    items.flatMap((item) => (item.kind === "single_choice" ? item.options.map((option) => option.id) : [])),
  );
  for (const response of responses) {
    if (response.kind !== "single_choice" || response.skipped || !response.optionId) continue;
    if (!validOptionIds.has(response.optionId)) continue;
    const label = V3_PILOT_UNCERTAINTY_LOADINGS[response.optionId];
    if (label) counts[label] += 1;
  }
  return counts;
}
