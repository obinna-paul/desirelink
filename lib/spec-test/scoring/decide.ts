import "server-only";

// server-only. Implements report §6.2's four result-decision rules, in priority order:
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
import type { ScoringVector } from "@/lib/spec-test/scoring/archetypes";
import type { ArchetypeKey, LensKey, MotiveKey, ResultConfidence } from "@/lib/spec-test/taxonomy";

/** Minimum probability lead the top archetype needs over the runner-up to call the result
 *  "clear" rather than "blend". Provisional - report §6.1: "tune it against validation data". */
export const CLEAR_MARGIN = 0.15;

export type SpecTestDecision =
  | {
      confidence: "low_signal";
      quality: "low_signal";
      qualityFlags: QualityFlag[];
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
