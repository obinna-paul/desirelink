import "server-only";

import { SPEC_TEST_ITEMS_V3, type SpecItemV3 } from "@/lib/spec-test/items/spec-v3";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import type { SpecTestDecision } from "@/lib/spec-test/scoring/decide";
import { deriveLenses, motiveFacetsFromVector, motiveScoresFromVector, type AttachmentScore } from "@/lib/spec-test/scoring/score";
import { scoreV3PilotAttraction, scoreV3PilotUncertainty } from "@/lib/spec-test/scoring/pilot-v3";
import type { ScoringVector } from "@/lib/spec-test/scoring/archetypes";
import {
  ARCHETYPE_KEYS,
  SCORING_DIMENSION_KEYS,
  type ArchetypeKey,
  type AttachmentResponseLabel,
  type ScoringDimensionKey,
} from "@/lib/spec-test/taxonomy";

/**
 * In v3 every attraction dimension owns one headline archetype. This is intentionally more
 * transparent than fitting unvalidated eight-way centroids: the strongest measured motive
 * names the primary Spec, and the next strongest names the secondary influence.
 */
export const V3_DIMENSION_ARCHETYPE: Record<ScoringDimensionKey, ArchetypeKey> = {
  warmthResponsiveness: "soft_landing",
  reliabilityReciprocity: "grounded_equal",
  socialVitality: "electric_charmer",
  agencyDirection: "ambitious_icon",
  cognitivePlay: "brilliant_tease",
  noveltyAutonomy: "free_spirit",
  containedDepthPrivacy: "quiet_fire",
  aestheticSelectivity: "beautiful_mystery",
};

export const V3_SKIP_CAP = 3;
export const V3_SPEED_FLOOR_MS = 650;
export const V3_SPEED_FLOOR_COUNT = 5;
export const V3_MIN_PROFILE_SPREAD = 0.12;
export const V3_CLEAR_SCORE_GAP = 0.18;
export const V3_CLEAR_PROFILE_SPREAD = 0.35;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function toHundredPoint(value: number | null): number {
  return Math.round(clamp(((value ?? 0) + 1) * 50, 0, 100));
}

function softmaxByDimension(values: Record<ScoringDimensionKey, number>): Record<ArchetypeKey, number> {
  const temperature = 0.3;
  const logits = SCORING_DIMENSION_KEYS.map((dimension) => values[dimension] / temperature);
  const maxLogit = Math.max(...logits);
  const exponentials = logits.map((logit) => Math.exp(logit - maxLogit));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  const probabilities = Object.fromEntries(ARCHETYPE_KEYS.map((key) => [key, 0])) as Record<ArchetypeKey, number>;
  SCORING_DIMENSION_KEYS.forEach((dimension, index) => {
    probabilities[V3_DIMENSION_ARCHETYPE[dimension]] = exponentials[index] / total;
  });
  return probabilities;
}

function attachmentFromResponses(responses: SpecTestResponseV3[]): AttachmentScore | null {
  const counts = scoreV3PilotUncertainty(SPEC_TEST_ITEMS_V3, responses);
  const answered = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (answered === 0) return null;

  const anxiety = Math.round(((counts.reassuranceSensitive + counts.pushPull) / answered) * 100);
  const avoidance = Math.round(((counts.spaceProtective + counts.pushPull) / answered) * 100);
  let label: AttachmentResponseLabel = "steadyUnderUncertainty";
  if (anxiety > 50 && avoidance > 50) label = "pushPull";
  else if (anxiety > 50) label = "reassuranceSensitive";
  else if (avoidance > 50) label = "spaceProtective";
  else {
    const ranked = Object.entries(counts).sort((left, right) => right[1] - left[1]);
    if (ranked[0][1] > ranked[1][1]) label = ranked[0][0] as AttachmentResponseLabel;
  }
  return { anxiety, avoidance, label };
}

export function decideSpecTestResultV3(
  items: SpecItemV3[],
  responses: SpecTestResponseV3[],
): SpecTestDecision {
  const qualityFlags: Array<"too_fast" | "excessive_skips" | "insufficient_pattern"> = [];
  const skippedCount = responses.filter((response) => response.skipped).length;
  if (skippedCount > V3_SKIP_CAP) qualityFlags.push("excessive_skips");
  const tooFastCount = responses.filter(
    (response) => !response.skipped && response.elapsedMs < V3_SPEED_FLOOR_MS,
  ).length;
  if (tooFastCount >= V3_SPEED_FLOOR_COUNT) qualityFlags.push("too_fast");

  const profile = scoreV3PilotAttraction(items, responses);
  const dimensionValues = Object.fromEntries(
    SCORING_DIMENSION_KEYS.map((dimension) => [dimension, profile[dimension].combinedScore ?? 0]),
  ) as Record<ScoringDimensionKey, number>;
  const rankedDimensions = [...SCORING_DIMENSION_KEYS].sort(
    (left, right) => dimensionValues[right] - dimensionValues[left],
  );
  const profileSpread =
    dimensionValues[rankedDimensions[0]] - dimensionValues[rankedDimensions[rankedDimensions.length - 1]];
  if (profileSpread < V3_MIN_PROFILE_SPREAD) qualityFlags.push("insufficient_pattern");

  if (qualityFlags.length > 0) {
    return { confidence: "low_signal", quality: "low_signal", qualityFlags };
  }

  const primarySpec = V3_DIMENSION_ARCHETYPE[rankedDimensions[0]];
  const secondarySpec = V3_DIMENSION_ARCHETYPE[rankedDimensions[1]];
  const scoreGap = dimensionValues[rankedDimensions[0]] - dimensionValues[rankedDimensions[1]];
  const vector = Object.fromEntries(
    SCORING_DIMENSION_KEYS.map((dimension) => [dimension, toHundredPoint(dimensionValues[dimension])]),
  ) as ScoringVector;

  return {
    confidence:
      scoreGap >= V3_CLEAR_SCORE_GAP && profileSpread >= V3_CLEAR_PROFILE_SPREAD ? "clear" : "blend",
    quality: "usable",
    qualityFlags: [],
    primarySpec,
    secondarySpec,
    probabilities: softmaxByDimension(dimensionValues),
    motiveScores: motiveScoresFromVector(vector),
    motiveFacets: motiveFacetsFromVector(vector),
    lenses: deriveLenses(vector),
    attachment: attachmentFromResponses(responses),
    // v3 measures durable attraction signals and uncertainty separately; it does not invent
    // a four-item Partnership classifier. The primary pattern therefore populates both
    // compatibility fields and never creates a false Spark/Partnership split.
    sparkPrimarySpec: primarySpec,
    partnershipPrimarySpec: primarySpec,
  };
}
