import "server-only";

// server-only. Preserves the v2.0/v2.1 decision rules and adds the version-routed v2.2
// forced-choice-native replacement. The legacy path implements report §6.2's rules:
// low_signal (a quality gate, checked first and unconditionally) > split (Spark and
// Partnership point at different archetypes - reported even when there's a confident overall
// primary, since it's the more informative reading per report §7's "who pulls you in vs who
// works for you") > clear (a decisive margin) > blend (everything else). There is
// deliberately no fifth branch that assigns an archetype when none of the above apply - see
// docs/spec-test-v2-implementation-plan.md §12.3 "No fallback".

import type { SpecItemV2 } from "@/lib/spec-test/items/spec-v2";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";
import {
  archetypeDistances,
  archetypeProbabilities,
  computeScoringVector,
  deriveLenses,
  itemsInSection,
  motiveFacetsFromVector,
  motiveScoresFromVector,
  rankedArchetypes,
  scoreAttachment,
  type AttachmentScore,
} from "@/lib/spec-test/scoring/score";
import { assessResponseQuality, type QualityFlag } from "@/lib/spec-test/scoring/quality";
import {
  computeForcedChoiceDimensionVector,
  computeForcedChoiceProfile,
} from "@/lib/spec-test/scoring/forced-choice";
import type { ScoringVector } from "@/lib/spec-test/scoring/archetypes";
import {
  INSTRUMENT_VERSION,
  LEGACY_INSTRUMENT_VERSION_V2_0,
  LEGACY_INSTRUMENT_VERSION_V2_1,
  type ArchetypeKey,
  type LensKey,
  type MotiveKey,
  type ResultConfidence,
} from "@/lib/spec-test/taxonomy";

/** Minimum probability lead the top archetype needs over the runner-up to call the result
 *  "clear" rather than "blend". Provisional - report §6.1: "tune it against validation data". */
export const CLEAR_MARGIN = 0.15;

/** v2.2 provisional gates. Standardized evidence is centered at zero under uniform random
 * choice; 2.25 requires a real cross-item pattern before a branded type is issued. */
export const V22_MIN_PATTERN_EVIDENCE = 2.25;
export const V22_CLEAR_EVIDENCE = 3;
export const V22_CLEAR_MARGIN = 0.15;
export const V22_MIN_SPLIT_ITEMS_PER_SECTION = 6;

export type QualityFlagV22 = QualityFlag | "insufficient_pattern";

export type SpecTestDecision =
  | {
      confidence: "low_signal";
      quality: "low_signal";
      qualityFlags: QualityFlagV22[];
    }
  | {
      confidence: Exclude<ResultConfidence, "low_signal">;
      quality: "usable";
      qualityFlags: QualityFlag[];
      primarySpec: ArchetypeKey;
      secondarySpec: ArchetypeKey;
      probabilities: Record<ArchetypeKey, number>;
      motiveScores: Record<MotiveKey, number>;
      motiveFacets: { containedDepthPrivacy: number; aestheticSelectivity: number };
      lenses: Record<LensKey, number>;
      attachment: AttachmentScore | null;
      sparkPrimarySpec: ArchetypeKey;
      partnershipPrimarySpec: ArchetypeKey;
    };

/** Legacy v2.0/v2.1 classifier, preserved byte-for-byte in behavior for old clients/results. */
export function decideSpecTestResult(items: SpecItemV2[], responses: SpecTestResponseV2[]): SpecTestDecision {
  const { quality, flags } = assessResponseQuality(items, responses);
  if (quality === "low_signal") {
    return { confidence: "low_signal", quality: "low_signal", qualityFlags: flags };
  }

  const vector: ScoringVector = computeScoringVector(items, responses);
  const distances = archetypeDistances(vector);
  const probabilities = archetypeProbabilities(distances);
  const [primarySpec, secondarySpec] = rankedArchetypes(probabilities);

  const sparkVector = computeScoringVector(itemsInSection(items, "spark"), responses);
  const partnershipVector = computeScoringVector(itemsInSection(items, "partnership"), responses);
  const [sparkPrimarySpec] = rankedArchetypes(archetypeProbabilities(archetypeDistances(sparkVector)));
  const [partnershipPrimarySpec] = rankedArchetypes(archetypeProbabilities(archetypeDistances(partnershipVector)));

  const margin = probabilities[primarySpec] - probabilities[secondarySpec];

  let confidence: Exclude<ResultConfidence, "low_signal">;
  if (sparkPrimarySpec !== partnershipPrimarySpec) {
    confidence = "split";
  } else if (margin >= CLEAR_MARGIN) {
    confidence = "clear";
  } else {
    confidence = "blend";
  }

  return {
    confidence,
    quality: "usable",
    qualityFlags: flags,
    primarySpec,
    secondarySpec,
    probabilities,
    motiveScores: motiveScoresFromVector(vector),
    motiveFacets: motiveFacetsFromVector(vector),
    lenses: deriveLenses(vector),
    attachment: scoreAttachment(responses),
    sparkPrimarySpec,
    partnershipPrimarySpec,
  };
}

/** Current spec-v2.2 classifier. Forced-choice evidence is centered against random choice,
 * skips are omitted symmetrically, and the four-item Partnership section cannot on its own
 * force a split label. */
export function decideSpecTestResultV22(
  items: SpecItemV2[],
  responses: SpecTestResponseV2[],
): SpecTestDecision {
  const { quality, flags } = assessResponseQuality(items, responses, { contradictionMode: "diagnostic" });
  if (quality === "low_signal") {
    return { confidence: "low_signal", quality: "low_signal", qualityFlags: flags };
  }

  const profile = computeForcedChoiceProfile(items, responses);
  const [primarySpec, secondarySpec] = profile.ranked;
  const strongestEvidence = profile.evidence[primarySpec].standardizedEvidence;
  if (strongestEvidence < V22_MIN_PATTERN_EVIDENCE) {
    return {
      confidence: "low_signal",
      quality: "low_signal",
      qualityFlags: [...flags, "insufficient_pattern"],
    };
  }

  const vector = computeForcedChoiceDimensionVector(items, responses) as ScoringVector;
  const sparkItems = itemsInSection(items, "spark");
  const partnershipItems = itemsInSection(items, "partnership");
  const sparkProfile = computeForcedChoiceProfile(sparkItems, responses);
  const partnershipProfile = computeForcedChoiceProfile(partnershipItems, responses);
  const sparkPrimarySpec = sparkProfile.ranked[0];
  const partnershipPrimarySpec = partnershipProfile.ranked[0];
  const sparkAnswered = responses.filter(
    (answer) => !answer.skipped && answer.optionId && sparkItems.some((item) => item.id === answer.itemId),
  ).length;
  const partnershipAnswered = responses.filter(
    (answer) => !answer.skipped && answer.optionId && partnershipItems.some((item) => item.id === answer.itemId),
  ).length;
  const margin = profile.probabilities[primarySpec] - profile.probabilities[secondarySpec];

  let confidence: Exclude<ResultConfidence, "low_signal">;
  if (
    sparkAnswered >= V22_MIN_SPLIT_ITEMS_PER_SECTION &&
    partnershipAnswered >= V22_MIN_SPLIT_ITEMS_PER_SECTION &&
    sparkPrimarySpec !== partnershipPrimarySpec
  ) {
    confidence = "split";
  } else if (strongestEvidence >= V22_CLEAR_EVIDENCE && margin >= V22_CLEAR_MARGIN) {
    confidence = "clear";
  } else {
    confidence = "blend";
  }

  return {
    confidence,
    quality: "usable",
    qualityFlags: flags,
    primarySpec,
    secondarySpec,
    probabilities: profile.probabilities,
    motiveScores: motiveScoresFromVector(vector),
    motiveFacets: motiveFacetsFromVector(vector),
    lenses: deriveLenses(vector),
    attachment: scoreAttachment(responses),
    sparkPrimarySpec,
    partnershipPrimarySpec,
  };
}

export function decideSpecTestResultForVersion(
  instrumentVersion: string,
  items: SpecItemV2[],
  responses: SpecTestResponseV2[],
): SpecTestDecision {
  if (instrumentVersion === INSTRUMENT_VERSION) {
    return decideSpecTestResultV22(items, responses);
  }
  if (
    instrumentVersion === LEGACY_INSTRUMENT_VERSION_V2_1 ||
    instrumentVersion === LEGACY_INSTRUMENT_VERSION_V2_0
  ) {
    return decideSpecTestResult(items, responses);
  }
  throw new Error(`Unsupported Spec Test scoring version: ${instrumentVersion}`);
}
