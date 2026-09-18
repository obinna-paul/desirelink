import "server-only";

// Reproducible, response-derived diagnostics for the Spec Test scoring engine. Unlike the
// centroid self-resolution unit test, every reachability/stability check in this module starts
// with valid item responses and passes through the applicable versioned scorer. This is
// analysis tooling, not part of the submit path.

import type { SpecItemV2 } from "@/lib/spec-test/items/spec-v2";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";
import {
  ARCHETYPE_KEYS,
  SCORING_DIMENSION_KEYS,
  SECTION_WEIGHTS,
  type ArchetypeKey,
  type ScoringDimensionKey,
} from "@/lib/spec-test/taxonomy";
import { ARCHETYPE_CENTROIDS } from "@/lib/spec-test/scoring/archetypes";
import { OPTION_MOTIVE_LOADINGS } from "@/lib/spec-test/scoring/loadings";
import {
  archetypeDistances,
  archetypeProbabilities,
  computeScoringVector,
  rankedArchetypes,
} from "@/lib/spec-test/scoring/score";
import {
  decideSpecTestResultV22,
  V22_MIN_PATTERN_EVIDENCE,
} from "@/lib/spec-test/scoring/decide";
import { computeForcedChoiceProfile } from "@/lib/spec-test/scoring/forced-choice";

export type ScoreSpaceDiagnostics = {
  scoredItemCount: number;
  dimensionExposure: Record<ScoringDimensionKey, { itemCount: number; weightedExposure: number }>;
  equalWeightedExposure: boolean;
  totalChosenWeight: number;
  completeResponseScoreSum: number | null;
  completeResponseScoreMean: number | null;
  nullExpectedVector: Record<ScoringDimensionKey, number>;
  centroidLevels: Record<ArchetypeKey, { sum: number; mean: number }>;
  maxCentroidBaselineGap: number;
};

export type NullSimulationDiagnostics = {
  samples: number;
  seed: number;
  meanVector: Record<ScoringDimensionKey, number>;
  winnerCounts: Record<ArchetypeKey, number>;
  winnerShares: Record<ArchetypeKey, number>;
  largestWinner: ArchetypeKey;
  largestWinnerShare: number;
};

export type ArchetypeReachabilityDiagnostic = {
  archetype: ArchetypeKey;
  reachable: boolean;
  winner: ArchetypeKey;
  classificationMargin: number;
  targetProbability: number;
  targetRank: number;
  vector: Record<ScoringDimensionKey, number>;
  optionIds: string[];
  targetEvidence?: number;
};

export type PerturbationDiagnostics = {
  baselineWinner: ArchetypeKey;
  trials: number;
  winnerChanges: number;
  winnerChangeRate: number;
  winnersAfterChange: Record<ArchetypeKey, number>;
};

export type DecisionNullSimulationDiagnostics = {
  samples: number;
  seed: number;
  lowSignalCount: number;
  lowSignalRate: number;
  usableCount: number;
  winnerCounts: Record<ArchetypeKey, number>;
  /** Share of usable decisions, not of all simulated attempts. */
  usableWinnerShares: Record<ArchetypeKey, number>;
  confidenceCounts: { clear: number; blend: number; split: number };
};

export type ScoringHealthFlag =
  | "score_space_baseline_mismatch"
  | "null_distribution_collapse"
  | "archetype_not_reached";

export type V22ScoringHealthFlag =
  | "excessive_null_acceptance"
  | "null_winner_imbalance"
  | "archetype_not_reached";

export type ScoringLaboratoryReport = {
  scoreSpace: ScoreSpaceDiagnostics;
  nullSimulation: NullSimulationDiagnostics;
  reachability: ArchetypeReachabilityDiagnostic[];
  v22Reachability: ArchetypeReachabilityDiagnostic[];
  v22NullDecisions: DecisionNullSimulationDiagnostics;
  legacyHealthFlags: ScoringHealthFlag[];
  v22HealthFlags: V22ScoringHealthFlag[];
};

function emptyDimensionRecord<T>(factory: () => T): Record<ScoringDimensionKey, T> {
  return Object.fromEntries(SCORING_DIMENSION_KEYS.map((dimension) => [dimension, factory()])) as Record<
    ScoringDimensionKey,
    T
  >;
}

function sumVector(vector: Record<ScoringDimensionKey, number>): number {
  return SCORING_DIMENSION_KEYS.reduce((sum, dimension) => sum + vector[dimension], 0);
}

function motiveOptions(item: SpecItemV2) {
  return item.options.filter((option) => OPTION_MOTIVE_LOADINGS[option.id] !== undefined);
}

function response(item: SpecItemV2, optionId: string): SpecTestResponseV2 {
  const presentedIndex = item.options.findIndex((option) => option.id === optionId);
  return { itemId: item.id, optionId, presentedIndex, elapsedMs: 3_000 };
}

function classify(items: SpecItemV2[], responses: SpecTestResponseV2[]) {
  const vector = computeScoringVector(items, responses);
  const probabilities = archetypeProbabilities(archetypeDistances(vector));
  const ranked = rankedArchetypes(probabilities);
  return { vector, probabilities, ranked };
}

/** Exact structural measurements of the current item bank and centroid configuration. */
export function analyzeScoreSpace(items: SpecItemV2[]): ScoreSpaceDiagnostics {
  const dimensionExposure = emptyDimensionRecord(() => ({ itemCount: 0, weightedExposure: 0 }));
  let scoredItemCount = 0;
  let totalChosenWeight = 0;

  for (const item of items) {
    const options = motiveOptions(item);
    if (options.length === 0) continue;
    scoredItemCount += 1;
    const weight = SECTION_WEIGHTS[item.section];
    totalChosenWeight += weight;

    for (const option of options) {
      const dimension = OPTION_MOTIVE_LOADINGS[option.id];
      const bucket = dimensionExposure[dimension];
      bucket.itemCount += 1;
      bucket.weightedExposure += weight;
    }
  }

  const exposures = SCORING_DIMENSION_KEYS.map(
    (dimension) => dimensionExposure[dimension].weightedExposure,
  );
  const equalWeightedExposure = exposures.every(
    (exposure) => Math.abs(exposure - exposures[0]) < 1e-9,
  );
  const completeResponseScoreSum =
    equalWeightedExposure && exposures[0] > 0 ? (100 * totalChosenWeight) / exposures[0] : null;
  const completeResponseScoreMean =
    completeResponseScoreSum === null ? null : completeResponseScoreSum / SCORING_DIMENSION_KEYS.length;

  const nullExpectedVector = emptyDimensionRecord(() => 0);
  for (const item of items) {
    const options = motiveOptions(item);
    if (options.length === 0) continue;
    const weight = SECTION_WEIGHTS[item.section];
    for (const option of options) {
      const dimension = OPTION_MOTIVE_LOADINGS[option.id];
      nullExpectedVector[dimension] += weight / options.length;
    }
  }
  for (const dimension of SCORING_DIMENSION_KEYS) {
    const exposure = dimensionExposure[dimension].weightedExposure;
    nullExpectedVector[dimension] = exposure > 0 ? (100 * nullExpectedVector[dimension]) / exposure : 50;
  }

  const centroidLevels = {} as Record<ArchetypeKey, { sum: number; mean: number }>;
  for (const archetype of ARCHETYPE_KEYS) {
    const sum = sumVector(ARCHETYPE_CENTROIDS[archetype]);
    centroidLevels[archetype] = { sum, mean: sum / SCORING_DIMENSION_KEYS.length };
  }
  const nullMean = sumVector(nullExpectedVector) / SCORING_DIMENSION_KEYS.length;
  const maxCentroidBaselineGap = Math.max(
    ...ARCHETYPE_KEYS.map((archetype) => Math.abs(centroidLevels[archetype].mean - nullMean)),
  );

  return {
    scoredItemCount,
    dimensionExposure,
    equalWeightedExposure,
    totalChosenWeight,
    completeResponseScoreSum,
    completeResponseScoreMean,
    nullExpectedVector,
    centroidLevels,
    maxCentroidBaselineGap,
  };
}

/** Small deterministic PRNG so a report can be reproduced without adding a dependency. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Uniform-choice null model. It is a structural diagnostic, not a population forecast. */
export function simulateNullDistribution(
  items: SpecItemV2[],
  { samples = 10_000, seed = 20_260_918 }: { samples?: number; seed?: number } = {},
): NullSimulationDiagnostics {
  if (!Number.isInteger(samples) || samples <= 0) throw new Error("samples must be a positive integer");
  const random = mulberry32(seed);
  const winnerCounts = Object.fromEntries(ARCHETYPE_KEYS.map((key) => [key, 0])) as Record<
    ArchetypeKey,
    number
  >;
  const meanVector = emptyDimensionRecord(() => 0);

  for (let sample = 0; sample < samples; sample += 1) {
    const responses = items.map((item) => {
      const optionIndex = Math.floor(random() * item.options.length);
      return response(item, item.options[optionIndex].id);
    });
    const result = classify(items, responses);
    winnerCounts[result.ranked[0]] += 1;
    for (const dimension of SCORING_DIMENSION_KEYS) {
      meanVector[dimension] += result.vector[dimension] / samples;
    }
  }

  const winnerShares = Object.fromEntries(
    ARCHETYPE_KEYS.map((key) => [key, winnerCounts[key] / samples]),
  ) as Record<ArchetypeKey, number>;
  const largestWinner = [...ARCHETYPE_KEYS].sort((a, b) => winnerShares[b] - winnerShares[a])[0];

  return {
    samples,
    seed,
    meanVector,
    winnerCounts,
    winnerShares,
    largestWinner,
    largestWinnerShare: winnerShares[largestWinner],
  };
}

function classificationMargin(
  archetype: ArchetypeKey,
  probabilities: Record<ArchetypeKey, number>,
): number {
  const bestOther = Math.max(
    ...ARCHETYPE_KEYS.filter((candidate) => candidate !== archetype).map(
      (candidate) => probabilities[candidate],
    ),
  );
  return probabilities[archetype] - bestOther;
}

/**
 * Searches only valid response patterns for the strongest classification margin it can find
 * for an archetype. This is a deterministic multi-start coordinate search, not a proof of
 * mathematical impossibility: `reachable: false` means the search failed and requires deeper
 * investigation, never that no answer pattern exists.
 */
export function searchArchetypeReachability(
  items: SpecItemV2[],
  archetype: ArchetypeKey,
  { restarts = 24, seed = 20_260_918 }: { restarts?: number; seed?: number } = {},
): ArchetypeReachabilityDiagnostic {
  const random = mulberry32(seed + ARCHETYPE_KEYS.indexOf(archetype) * 997);
  const scoredItems = items.filter((item) => motiveOptions(item).length > 0);
  let best:
    | {
        margin: number;
        vector: Record<ScoringDimensionKey, number>;
        probabilities: Record<ArchetypeKey, number>;
        ranked: ArchetypeKey[];
        optionIds: string[];
      }
    | undefined;

  for (let restart = 0; restart < restarts; restart += 1) {
    const optionIds = scoredItems.map((item) => {
      const options = motiveOptions(item);
      return options[Math.floor(random() * options.length)].id;
    });

    let changed = true;
    let passes = 0;
    while (changed && passes < 30) {
      changed = false;
      passes += 1;

      for (let itemIndex = 0; itemIndex < scoredItems.length; itemIndex += 1) {
        const item = scoredItems[itemIndex];
        const previous = optionIds[itemIndex];
        let localBestOption = previous;
        let localBestMargin = Number.NEGATIVE_INFINITY;

        for (const option of motiveOptions(item)) {
          optionIds[itemIndex] = option.id;
          const responses = scoredItems.map((candidateItem, index) =>
            response(candidateItem, optionIds[index]),
          );
          const result = classify(scoredItems, responses);
          const margin = classificationMargin(archetype, result.probabilities);
          if (margin > localBestMargin + 1e-12) {
            localBestMargin = margin;
            localBestOption = option.id;
          }
        }

        optionIds[itemIndex] = localBestOption;
        if (localBestOption !== previous) changed = true;
      }
    }

    const responses = scoredItems.map((item, index) => response(item, optionIds[index]));
    const result = classify(scoredItems, responses);
    const margin = classificationMargin(archetype, result.probabilities);
    if (!best || margin > best.margin) {
      best = { margin, ...result, optionIds: [...optionIds] };
    }
  }

  if (!best) throw new Error("reachability search requires at least one scored item and restart");
  return {
    archetype,
    reachable: best.ranked[0] === archetype,
    winner: best.ranked[0],
    classificationMargin: best.margin,
    targetProbability: best.probabilities[archetype],
    targetRank: best.ranked.indexOf(archetype) + 1,
    vector: best.vector,
    optionIds: best.optionIds,
  };
}

/** The same valid-response search evaluated in v2.2's standardized evidence space. */
export function searchV22ArchetypeReachability(
  items: SpecItemV2[],
  archetype: ArchetypeKey,
  { restarts = 24, seed = 20_260_918 }: { restarts?: number; seed?: number } = {},
): ArchetypeReachabilityDiagnostic {
  const random = mulberry32(seed + ARCHETYPE_KEYS.indexOf(archetype) * 1_009);
  const scoredItems = items.filter((item) => motiveOptions(item).length > 0);
  let best:
    | {
        objective: number;
        margin: number;
        targetEvidence: number;
        probabilities: Record<ArchetypeKey, number>;
        ranked: ArchetypeKey[];
        optionIds: string[];
        vector: Record<ScoringDimensionKey, number>;
      }
    | undefined;

  const evaluate = (optionIds: string[]) => {
    const responses = scoredItems.map((item, index) => response(item, optionIds[index]));
    const profile = computeForcedChoiceProfile(scoredItems, responses);
    const targetEvidence = profile.evidence[archetype].standardizedEvidence;
    const strongestOtherEvidence = Math.max(
      ...ARCHETYPE_KEYS.filter((candidate) => candidate !== archetype).map(
        (candidate) => profile.evidence[candidate].standardizedEvidence,
      ),
    );
    return {
      objective: targetEvidence - strongestOtherEvidence + 0.05 * targetEvidence,
      margin: classificationMargin(archetype, profile.probabilities),
      targetEvidence,
      probabilities: profile.probabilities,
      ranked: profile.ranked,
      vector: computeScoringVector(scoredItems, responses),
    };
  };

  for (let restart = 0; restart < restarts; restart += 1) {
    const optionIds = scoredItems.map((item) => {
      const options = motiveOptions(item);
      return options[Math.floor(random() * options.length)].id;
    });
    let changed = true;
    let passes = 0;

    while (changed && passes < 30) {
      changed = false;
      passes += 1;
      for (let itemIndex = 0; itemIndex < scoredItems.length; itemIndex += 1) {
        const item = scoredItems[itemIndex];
        const previous = optionIds[itemIndex];
        let localBestOption = previous;
        let localBestObjective = Number.NEGATIVE_INFINITY;
        for (const option of motiveOptions(item)) {
          optionIds[itemIndex] = option.id;
          const candidate = evaluate(optionIds);
          if (candidate.objective > localBestObjective + 1e-12) {
            localBestObjective = candidate.objective;
            localBestOption = option.id;
          }
        }
        optionIds[itemIndex] = localBestOption;
        if (localBestOption !== previous) changed = true;
      }
    }

    const result = evaluate(optionIds);
    if (!best || result.objective > best.objective) best = { ...result, optionIds: [...optionIds] };
  }

  if (!best) throw new Error("reachability search requires at least one scored item and restart");
  return {
    archetype,
    reachable: best.ranked[0] === archetype && best.targetEvidence >= V22_MIN_PATTERN_EVIDENCE,
    winner: best.ranked[0],
    classificationMargin: best.margin,
    targetProbability: best.probabilities[archetype],
    targetRank: best.ranked.indexOf(archetype) + 1,
    targetEvidence: best.targetEvidence,
    vector: best.vector,
    optionIds: best.optionIds,
  };
}

export function analyzeSingleAnswerPerturbations(
  items: SpecItemV2[],
  responses: SpecTestResponseV2[],
): PerturbationDiagnostics {
  const baseline = classify(items, responses);
  const baselineWinner = baseline.ranked[0];
  const byItem = new Map(responses.map((answer) => [answer.itemId, answer]));
  const winnersAfterChange = Object.fromEntries(ARCHETYPE_KEYS.map((key) => [key, 0])) as Record<
    ArchetypeKey,
    number
  >;
  let trials = 0;
  let winnerChanges = 0;

  for (const item of items) {
    const original = byItem.get(item.id);
    if (!original?.optionId || motiveOptions(item).length === 0) continue;

    for (const option of motiveOptions(item)) {
      if (option.id === original.optionId) continue;
      const changedResponses = responses.map((answer) =>
        answer.itemId === item.id ? response(item, option.id) : answer,
      );
      const changedWinner = classify(items, changedResponses).ranked[0];
      winnersAfterChange[changedWinner] += 1;
      trials += 1;
      if (changedWinner !== baselineWinner) winnerChanges += 1;
    }
  }

  return {
    baselineWinner,
    trials,
    winnerChanges,
    winnerChangeRate: trials > 0 ? winnerChanges / trials : 0,
    winnersAfterChange,
  };
}

/** Runs uniform random responses through the complete v2.2 decision path, including its
 * minimum-pattern gate. Random input should overwhelmingly produce low signal rather than a
 * branded archetype; usable winner shares reveal any residual access imbalance. */
export function simulateV22NullDecisions(
  items: SpecItemV2[],
  { samples = 10_000, seed = 20_260_918 }: { samples?: number; seed?: number } = {},
): DecisionNullSimulationDiagnostics {
  if (!Number.isInteger(samples) || samples <= 0) throw new Error("samples must be a positive integer");
  const random = mulberry32(seed);
  const winnerCounts = Object.fromEntries(ARCHETYPE_KEYS.map((key) => [key, 0])) as Record<
    ArchetypeKey,
    number
  >;
  const confidenceCounts = { clear: 0, blend: 0, split: 0 };
  let lowSignalCount = 0;

  for (let sample = 0; sample < samples; sample += 1) {
    const responses = items.map((item, itemIndex) => {
      const optionIndex = Math.floor(random() * item.options.length);
      return {
        ...response(item, item.options[optionIndex].id),
        // Keep timing realistic and positions varied so this diagnostic isolates content
        // signal rather than intentionally tripping speed/straight-line quality gates.
        elapsedMs: 2_500 + ((sample + itemIndex) % 13) * 75,
      };
    });
    const decision = decideSpecTestResultV22(items, responses);
    if (decision.quality === "low_signal") {
      lowSignalCount += 1;
      continue;
    }
    winnerCounts[decision.primarySpec] += 1;
    confidenceCounts[decision.confidence] += 1;
  }

  const usableCount = samples - lowSignalCount;
  const usableWinnerShares = Object.fromEntries(
    ARCHETYPE_KEYS.map((key) => [key, usableCount > 0 ? winnerCounts[key] / usableCount : 0]),
  ) as Record<ArchetypeKey, number>;

  return {
    samples,
    seed,
    lowSignalCount,
    lowSignalRate: lowSignalCount / samples,
    usableCount,
    winnerCounts,
    usableWinnerShares,
    confidenceCounts,
  };
}

export function buildScoringLaboratoryReport(
  items: SpecItemV2[],
  options: { nullSamples?: number; seed?: number; reachabilityRestarts?: number } = {},
): ScoringLaboratoryReport {
  const scoreSpace = analyzeScoreSpace(items);
  const nullSimulation = simulateNullDistribution(items, {
    samples: options.nullSamples ?? 10_000,
    seed: options.seed,
  });
  const reachability = ARCHETYPE_KEYS.map((archetype) =>
    searchArchetypeReachability(items, archetype, {
      restarts: options.reachabilityRestarts ?? 24,
      seed: options.seed,
    }),
  );
  const v22NullDecisions = simulateV22NullDecisions(items, {
    samples: options.nullSamples ?? 10_000,
    seed: options.seed,
  });
  const v22Reachability = ARCHETYPE_KEYS.map((archetype) =>
    searchV22ArchetypeReachability(items, archetype, {
      restarts: options.reachabilityRestarts ?? 24,
      seed: options.seed,
    }),
  );
  const legacyHealthFlags: ScoringHealthFlag[] = [];

  // A ten-point baseline gap is already half of the provisional SIGMA=20 used by the
  // production distance. The current instrument exceeds this by a wide margin.
  if (scoreSpace.maxCentroidBaselineGap >= 10) {
    legacyHealthFlags.push("score_space_baseline_mismatch");
  }
  if (nullSimulation.largestWinnerShare >= 0.35) {
    legacyHealthFlags.push("null_distribution_collapse");
  }
  if (reachability.some((result) => !result.reachable)) {
    legacyHealthFlags.push("archetype_not_reached");
  }

  const v22HealthFlags: V22ScoringHealthFlag[] = [];
  if (v22NullDecisions.lowSignalRate < 0.8) {
    v22HealthFlags.push("excessive_null_acceptance");
  }
  if (Math.max(...Object.values(v22NullDecisions.usableWinnerShares)) > 0.25) {
    v22HealthFlags.push("null_winner_imbalance");
  }
  if (v22Reachability.some((result) => !result.reachable)) {
    v22HealthFlags.push("archetype_not_reached");
  }

  return {
    scoreSpace,
    nullSimulation,
    reachability,
    v22Reachability,
    v22NullDecisions,
    legacyHealthFlags,
    v22HealthFlags,
  };
}
