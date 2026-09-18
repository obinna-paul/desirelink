import "server-only";

// Forced-choice-native scoring for spec-v2.2. Each answer is evaluated relative to the
// alternatives shown in that same item. Archetype-wide level differences therefore cancel
// out instead of making the lowest-total centroid the de facto fallback. Evidence is then
// centered and variance-standardized against uniform random choice, giving every archetype
// an expected null score of zero on a comparable scale.

import type { SpecItemV2 } from "@/lib/spec-test/items/spec-v2";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";
import { ARCHETYPE_CENTROIDS } from "@/lib/spec-test/scoring/archetypes";
import { OPTION_MOTIVE_LOADINGS } from "@/lib/spec-test/scoring/loadings";
import {
  ARCHETYPE_KEYS,
  SCORING_DIMENSION_KEYS,
  SECTION_WEIGHTS,
  type ArchetypeKey,
  type ScoringDimensionKey,
} from "@/lib/spec-test/taxonomy";

/** One provisional utility-scale step equals the existing centroid ladder's 20-point spread.
 * Ranking is much less sensitive to this value than the old absolute-distance calculation,
 * but it remains versioned and must be fitted once pilot data is large enough. */
export const FORCED_CHOICE_UTILITY_SCALE = 20;

/** Presentation temperature for relative evidence -> display/ranking probabilities. These
 * probabilities are internal ranking weights, not calibrated accuracy claims. */
export const FORCED_CHOICE_SOFTMAX_TEMPERATURE = 1.25;

/** Maps one null-standard-deviation of dimension preference to 15 display points, so neutral
 * choice sits at 50 and ±2 SD aligns with the existing low/high 20/80 narrative ladder. */
export const DIMENSION_SCORE_POINTS_PER_SD = 15;

export type ForcedChoiceArchetypeEvidence = {
  rawEvidence: number;
  nullVariance: number;
  standardizedEvidence: number;
  answeredItems: number;
};

export type ForcedChoiceProfile = {
  evidence: Record<ArchetypeKey, ForcedChoiceArchetypeEvidence>;
  probabilities: Record<ArchetypeKey, number>;
  ranked: ArchetypeKey[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function logSoftmax(values: number[]): number[] {
  const max = Math.max(...values);
  const logDenominator = max + Math.log(values.reduce((sum, value) => sum + Math.exp(value - max), 0));
  return values.map((value) => value - logDenominator);
}

function rankingProbabilities(
  evidence: Record<ArchetypeKey, ForcedChoiceArchetypeEvidence>,
): Record<ArchetypeKey, number> {
  const scaled = ARCHETYPE_KEYS.map(
    (archetype) => evidence[archetype].standardizedEvidence / FORCED_CHOICE_SOFTMAX_TEMPERATURE,
  );
  const max = Math.max(...scaled);
  const exponentials = scaled.map((value) => Math.exp(value - max));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(
    ARCHETYPE_KEYS.map((archetype, index) => [archetype, exponentials[index] / total]),
  ) as Record<ArchetypeKey, number>;
}

export function computeForcedChoiceProfile(
  items: SpecItemV2[],
  responses: SpecTestResponseV2[],
): ForcedChoiceProfile {
  const byItem = new Map(responses.map((answer) => [answer.itemId, answer]));
  const accumulators = Object.fromEntries(
    ARCHETYPE_KEYS.map((archetype) => [archetype, { rawEvidence: 0, nullVariance: 0, answeredItems: 0 }]),
  ) as Record<ArchetypeKey, { rawEvidence: number; nullVariance: number; answeredItems: number }>;

  for (const item of items) {
    const answer = byItem.get(item.id);
    if (!answer || answer.skipped || !answer.optionId) continue;

    const scoredOptions = item.options.filter((option) => OPTION_MOTIVE_LOADINGS[option.id] !== undefined);
    if (scoredOptions.length === 0 || !scoredOptions.some((option) => option.id === answer.optionId)) continue;
    const chosenIndex = scoredOptions.findIndex((option) => option.id === answer.optionId);
    const weight = SECTION_WEIGHTS[item.section];

    for (const archetype of ARCHETYPE_KEYS) {
      const utilities = scoredOptions.map((option) => {
        const dimension = OPTION_MOTIVE_LOADINGS[option.id];
        return ARCHETYPE_CENTROIDS[archetype][dimension] / FORCED_CHOICE_UTILITY_SCALE;
      });
      const logProbabilities = logSoftmax(utilities);
      const nullMean = logProbabilities.reduce((sum, value) => sum + value, 0) / logProbabilities.length;
      const centered = logProbabilities.map((value) => value - nullMean);
      const nullVariance = centered.reduce((sum, value) => sum + value * value, 0) / centered.length;

      accumulators[archetype].rawEvidence += weight * centered[chosenIndex];
      accumulators[archetype].nullVariance += weight * weight * nullVariance;
      accumulators[archetype].answeredItems += 1;
    }
  }

  const evidence = {} as Record<ArchetypeKey, ForcedChoiceArchetypeEvidence>;
  for (const archetype of ARCHETYPE_KEYS) {
    const accumulator = accumulators[archetype];
    evidence[archetype] = {
      ...accumulator,
      standardizedEvidence:
        accumulator.nullVariance > 0
          ? accumulator.rawEvidence / Math.sqrt(accumulator.nullVariance)
          : 0,
    };
  }

  const probabilities = rankingProbabilities(evidence);
  const ranked = [...ARCHETYPE_KEYS].sort((a, b) => {
    const difference = probabilities[b] - probabilities[a];
    return Math.abs(difference) > 1e-12 ? difference : ARCHETYPE_KEYS.indexOf(a) - ARCHETYPE_KEYS.indexOf(b);
  });

  return { evidence, probabilities, ranked };
}

/**
 * A 0–100 motive/facet vector for result copy and lenses. Each dimension is scored as signed
 * evidence above/below its chance selection rate within the items where it appeared, then
 * standardized by its own null variance. Unlike v2.1's percentage-of-opportunities score,
 * chance preference maps to 50 rather than 25 and a skipped item is omitted symmetrically.
 */
export function computeForcedChoiceDimensionVector(
  items: SpecItemV2[],
  responses: SpecTestResponseV2[],
): Record<ScoringDimensionKey, number> {
  const byItem = new Map(responses.map((answer) => [answer.itemId, answer]));
  const raw = Object.fromEntries(SCORING_DIMENSION_KEYS.map((dimension) => [dimension, 0])) as Record<
    ScoringDimensionKey,
    number
  >;
  const variance = Object.fromEntries(
    SCORING_DIMENSION_KEYS.map((dimension) => [dimension, 0]),
  ) as Record<ScoringDimensionKey, number>;

  for (const item of items) {
    const answer = byItem.get(item.id);
    if (!answer || answer.skipped || !answer.optionId) continue;
    const scoredOptions = item.options.filter((option) => OPTION_MOTIVE_LOADINGS[option.id] !== undefined);
    if (scoredOptions.length === 0 || !scoredOptions.some((option) => option.id === answer.optionId)) continue;

    const chance = 1 / scoredOptions.length;
    const weight = SECTION_WEIGHTS[item.section];
    for (const option of scoredOptions) {
      const dimension = OPTION_MOTIVE_LOADINGS[option.id];
      const chosen = option.id === answer.optionId ? 1 : 0;
      raw[dimension] += weight * (chosen - chance);
      variance[dimension] += weight * weight * chance * (1 - chance);
    }
  }

  return Object.fromEntries(
    SCORING_DIMENSION_KEYS.map((dimension) => {
      const standardized = variance[dimension] > 0 ? raw[dimension] / Math.sqrt(variance[dimension]) : 0;
      return [dimension, clamp(50 + DIMENSION_SCORE_POINTS_PER_SD * standardized, 0, 100)];
    }),
  ) as Record<ScoringDimensionKey, number>;
}
