import "server-only";

// server-only. The core v2 scoring functions: exposure-normalized motive scores (report
// §6.1), a derived lens profile, attachment-response scoring (report §6.3), and archetype
// distance/softmax matching (report §6.1). See docs/spec-test-v2-implementation-plan.md §6
// for the acceptance criteria this file is written to satisfy.

import {
  ARCHETYPE_KEYS,
  LENS_KEYS,
  SCORING_DIMENSION_KEYS,
  SECTION_WEIGHTS,
  type ArchetypeKey,
  type AttachmentResponseLabel,
  type LensKey,
  type MotiveKey,
  type ScoringDimensionKey,
  type SectionKey,
} from "@/lib/spec-test/taxonomy";
import type { SpecItemV2 } from "@/lib/spec-test/items/spec-v2";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";
import { OPTION_ATTACHMENT_LOADINGS, OPTION_MOTIVE_LOADINGS } from "@/lib/spec-test/scoring/loadings";
import { ALPHA, ARCHETYPE_CENTROIDS, SIGMA, TAU, type ScoringVector } from "@/lib/spec-test/scoring/archetypes";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function answeredResponse(response: SpecTestResponseV2 | undefined): response is SpecTestResponseV2 & { optionId: string } {
  return !!response && !response.skipped && typeof response.optionId === "string";
}

/**
 * Exposure-normalized 0-100 score per scoring dimension (report §6.1's M_k formula), computed
 * only over the given items/responses - callers pass the full bank for a respondent's overall
 * profile, or a section subset for the Spark-vs-Partnership split (see archetypeSplit below).
 * A dimension with no measuring item in the given subset returns 50 (neutral / "moderate"),
 * matching the same default used for unmentioned dimensions in the archetype centroids.
 */
export function computeScoringVector(items: SpecItemV2[], responses: SpecTestResponseV2[]): ScoringVector {
  const sums = Object.fromEntries(SCORING_DIMENSION_KEYS.map((key) => [key, 0])) as Record<ScoringDimensionKey, number>;
  const maxSums = Object.fromEntries(SCORING_DIMENSION_KEYS.map((key) => [key, 0])) as Record<ScoringDimensionKey, number>;

  const byId = new Map(responses.map((response) => [response.itemId, response]));

  for (const item of items) {
    const response = byId.get(item.id);
    if (!answeredResponse(response)) continue; // skipped/unanswered items reduce the denominator, not the numerator

    const weight = SECTION_WEIGHTS[item.section];
    let chosenDimension: ScoringDimensionKey | undefined;

    for (const option of item.options) {
      const dimension = OPTION_MOTIVE_LOADINGS[option.id];
      if (!dimension) continue; // attachment-scenario options carry no motive/facet loading
      maxSums[dimension] += weight;
      if (option.id === response.optionId) chosenDimension = dimension;
    }

    if (chosenDimension) sums[chosenDimension] += weight;
  }

  const vector = {} as ScoringVector;
  for (const dimension of SCORING_DIMENSION_KEYS) {
    vector[dimension] = maxSums[dimension] > 0 ? (100 * sums[dimension]) / maxSums[dimension] : 50;
  }
  return vector;
}

/** The report's §11 JSON schema stores a combined `intrigue_selective_access` motive score
 *  alongside the two separately-tracked facets. Combined here as a simple mean pending
 *  pilot data on whether/how the facets should be weighted against each other. */
export function motiveScoresFromVector(vector: ScoringVector): Record<MotiveKey, number> {
  const { containedDepthPrivacy, aestheticSelectivity, ...rest } = vector;
  return {
    ...(rest as Omit<ScoringVector, "containedDepthPrivacy" | "aestheticSelectivity">),
    intrigueSelectiveAccess: (containedDepthPrivacy + aestheticSelectivity) / 2,
  } as Record<MotiveKey, number>;
}

export function motiveFacetsFromVector(vector: ScoringVector) {
  return {
    containedDepthPrivacy: vector.containedDepthPrivacy,
    aestheticSelectivity: vector.aestheticSelectivity,
  };
}

function centered(vector: ScoringVector, key: ScoringDimensionKey): number {
  return vector[key] - 50;
}

/**
 * Derives the eight interpretive lenses from the motive vector via a fixed linear
 * projection, rather than from per-option authored lens deltas as report §6.3 literally
 * describes ("Each option carries a value of -1, 0 or +1 on relevant lenses"). This is a
 * documented v2.0 scoping simplification - see docs/spec-test-v2-implementation-plan.md
 * §6 - to be replaced by per-item authored deltas once item writers assign them; the
 * coefficients below are a defensible starting approximation, not a finding. Every
 * coefficient's sign is chosen so the lens's documented high pole (taxonomy.ts LENS_POLES)
 * is the one increased by that motive.
 */
export function deriveLenses(vector: ScoringVector): Record<LensKey, number> {
  const c = (key: ScoringDimensionKey) => centered(vector, key);

  const raw: Record<LensKey, number> = {
    // high = Spark (vitality/novelty), low = Safety (warmth/reliability)
    sparkSafety: 50 + 0.35 * c("socialVitality") + 0.35 * c("noveltyAutonomy") - 0.35 * c("warmthResponsiveness") - 0.35 * c("reliabilityReciprocity"),
    // high = Autonomy (novelty), low = Closeness (warmth)
    closenessAutonomy: 50 + 0.6 * c("noveltyAutonomy") - 0.4 * c("warmthResponsiveness"),
    // high = Fast burn (vitality/novelty), low = Slow burn (contained depth)
    fastSlow: 50 + 0.4 * c("socialVitality") + 0.3 * c("noveltyAutonomy") - 0.5 * c("containedDepthPrivacy"),
    // high = Intrigue (both I facets), low = Directness (reliability)
    directnessIntrigue: 50 + 0.35 * c("containedDepthPrivacy") + 0.35 * c("aestheticSelectivity") - 0.4 * c("reliabilityReciprocity"),
    // high = Public (vitality), low = Private (contained depth)
    privatePublic: 50 + 0.5 * c("socialVitality") - 0.5 * c("containedDepthPrivacy"),
    // high = Admiration (agency), low = Mutuality (reliability)
    admirationMutuality: 50 + 0.5 * c("agencyDirection") - 0.5 * c("reliabilityReciprocity"),
    // high = Mind (cognitive play), low = Embodied energy (vitality)
    mindEmbodied: 50 + 0.5 * c("cognitivePlay") - 0.5 * c("socialVitality"),
    // high = Exploration (novelty), low = Commitment (reliability)
    explorationCommitment: 50 + 0.5 * c("noveltyAutonomy") - 0.5 * c("reliabilityReciprocity"),
  };

  return Object.fromEntries(LENS_KEYS.map((key) => [key, clamp(raw[key], 0, 100)])) as Record<LensKey, number>;
}

export type AttachmentScore = {
  anxiety: number;
  avoidance: number;
  label: AttachmentResponseLabel;
};

/** Scores the four attachment-scenario items into the report's §3 Layer C ordinary-language
 *  labels. Returns null when no attachment item was answered (e.g. a hold-out test payload),
 *  so callers never fabricate an attachment read from nothing. */
export function scoreAttachment(responses: SpecTestResponseV2[]): AttachmentScore | null {
  let anxietySum = 0;
  let avoidanceSum = 0;
  let count = 0;

  for (const response of responses) {
    if (!answeredResponse(response)) continue;
    const delta = OPTION_ATTACHMENT_LOADINGS[response.optionId];
    if (!delta) continue;
    anxietySum += delta.anxiety;
    avoidanceSum += delta.avoidance;
    count += 1;
  }

  if (count === 0) return null;

  const anxiety = clamp(((anxietySum / count + 1) / 2) * 100, 0, 100);
  const avoidance = clamp(((avoidanceSum / count + 1) / 2) * 100, 0, 100);

  let label: AttachmentResponseLabel;
  if (anxiety >= 50 && avoidance >= 50) label = "pushPull";
  else if (anxiety >= 50) label = "reassuranceSensitive";
  else if (avoidance >= 50) label = "spaceProtective";
  else label = "steadyUnderUncertainty";

  return { anxiety, avoidance, label };
}

/** report §6.1's D_t: weighted squared distance from a score vector to an archetype's
 *  centroid, scaled per-dimension by SIGMA. */
export function archetypeDistances(vector: ScoringVector): Record<ArchetypeKey, number> {
  const distances = {} as Record<ArchetypeKey, number>;
  for (const key of ARCHETYPE_KEYS) {
    const centroid = ARCHETYPE_CENTROIDS[key];
    let sum = 0;
    for (const dimension of SCORING_DIMENSION_KEYS) {
      const diff = (vector[dimension] - centroid[dimension]) / SIGMA[dimension];
      sum += ALPHA[dimension] * diff * diff;
    }
    distances[key] = sum;
  }
  return distances;
}

/** report §6.1's softmax over centroid distances. Never displayed as "N% accurate" per the
 *  report's own instruction - used only to rank archetypes and to detect a close blend. */
export function archetypeProbabilities(distances: Record<ArchetypeKey, number>): Record<ArchetypeKey, number> {
  const exponentials = {} as Record<ArchetypeKey, number>;
  let total = 0;
  for (const key of ARCHETYPE_KEYS) {
    const value = Math.exp(-distances[key] / TAU);
    exponentials[key] = value;
    total += value;
  }
  const probabilities = {} as Record<ArchetypeKey, number>;
  for (const key of ARCHETYPE_KEYS) {
    probabilities[key] = total > 0 ? exponentials[key] / total : 1 / ARCHETYPE_KEYS.length;
  }
  return probabilities;
}

export function rankedArchetypes(probabilities: Record<ArchetypeKey, number>): ArchetypeKey[] {
  return [...ARCHETYPE_KEYS].sort((a, b) => probabilities[b] - probabilities[a]);
}

/** Restricts scoring to items in a single section - used to compute the Spark-only and
 *  Partnership-only vectors that the split decision (report §6.2, §7 "who pulls you in vs
 *  who works for you") compares against each other. */
export function itemsInSection(items: SpecItemV2[], section: SectionKey): SpecItemV2[] {
  return items.filter((item) => item.section === section);
}
