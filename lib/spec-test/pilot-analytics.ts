import "server-only";

import { prisma } from "@/lib/prisma";
import {
  SPEC_TEST_ITEMS_V3_PILOT,
  V3_PILOT_INSTRUMENT_VERSION,
} from "@/lib/spec-test/items/spec-v3-pilot";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import {
  MOTIVE_FACET_LABELS,
  MOTIVE_LABELS,
  SCORING_DIMENSION_KEYS,
  type ScoringDimensionKey,
} from "@/lib/spec-test/taxonomy";

export type PilotFunnelPoint = {
  completedCount: number;
  label: string;
  attemptsReached: number;
  reachRate: number;
};

export type PilotMotiveDistribution = {
  dimension: ScoringDimensionKey;
  label: string;
  count: number;
  mean: number | null;
  standardDeviation: number | null;
  minimum: number | null;
  maximum: number | null;
  developmentMean: number | null;
  holdoutMean: number | null;
};

export type PilotBestWorstOptionAnalytics = {
  optionId: string;
  label: string;
  bestCount: number;
  bestRate: number;
  worstCount: number;
  worstRate: number;
  netPreference: number;
};

export type PilotChoiceOptionAnalytics = {
  optionId: string;
  label: string;
  chosenCount: number;
  choiceRate: number;
};

type PilotItemAnalyticsBase = {
  itemId: string;
  prompt: string;
  answeredCount: number;
  skippedCount: number;
  skipRate: number;
  medianElapsedMs: number;
};

export type PilotBestWorstItemAnalytics = PilotItemAnalyticsBase & {
  kind: "best_worst";
  bestPositionCounts: [number, number, number, number];
  worstPositionCounts: [number, number, number, number];
  options: PilotBestWorstOptionAnalytics[];
};

export type PilotIntensityItemAnalytics = PilotItemAnalyticsBase & {
  kind: "intensity";
  ratingCounts: [number, number, number, number, number, number, number];
  meanRating: number | null;
  medianRating: number | null;
};

export type PilotChoiceItemAnalytics = PilotItemAnalyticsBase & {
  kind: "single_choice";
  positionCounts: [number, number, number, number];
  options: PilotChoiceOptionAnalytics[];
};

export type PilotItemAnalytics =
  | PilotBestWorstItemAnalytics
  | PilotIntensityItemAnalytics
  | PilotChoiceItemAnalytics;

export type SpecTestPilotAnalytics = {
  instrumentVersion: string;
  startedAttempts: number;
  completedSubmissions: number;
  completionRate: number;
  dataSplit: { development: number; holdout: number };
  qualityClean: { total: number; development: number; holdout: number };
  qualityFlaggedSubmissions: number;
  qualityFlagCounts: Record<string, number>;
  funnel: PilotFunnelPoint[];
  motives: PilotMotiveDistribution[];
  items: PilotItemAnalytics[];
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function stats(values: number[]) {
  if (values.length === 0) return { mean: null, standardDeviation: null, minimum: null, maximum: null };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {
    mean,
    standardDeviation: Math.sqrt(variance),
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

function dimensionLabel(dimension: ScoringDimensionKey): string {
  if (dimension === "containedDepthPrivacy" || dimension === "aestheticSelectivity") {
    return MOTIVE_FACET_LABELS[dimension];
  }
  return MOTIVE_LABELS[dimension];
}

function positionCounts(): [number, number, number, number] {
  return [0, 0, 0, 0];
}

function safePosition(value: unknown): value is 0 | 1 | 2 | 3 {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3;
}

type ItemBucket = {
  answered: number;
  skipped: number;
  elapsed: number[];
  best: Map<string, number>;
  worst: Map<string, number>;
  chosen: Map<string, number>;
  ratings: number[];
  bestPositions: [number, number, number, number];
  worstPositions: [number, number, number, number];
  positions: [number, number, number, number];
};

function emptyBucket(): ItemBucket {
  return {
    answered: 0,
    skipped: 0,
    elapsed: [],
    best: new Map(),
    worst: new Map(),
    chosen: new Map(),
    ratings: [],
    bestPositions: positionCounts(),
    worstPositions: positionCounts(),
    positions: positionCounts(),
  };
}

function buildItemAnalytics(rows: Array<{ responses: unknown }>): PilotItemAnalytics[] {
  const buckets = new Map(SPEC_TEST_ITEMS_V3_PILOT.map((item) => [item.id, emptyBucket()]));

  for (const row of rows) {
    if (!Array.isArray(row.responses)) continue;
    for (const response of row.responses as SpecTestResponseV3[]) {
      const bucket = buckets.get(response?.itemId);
      if (!bucket) continue;
      if (response.skipped) {
        bucket.skipped += 1;
        continue;
      }
      bucket.answered += 1;
      if (typeof response.elapsedMs === "number" && Number.isFinite(response.elapsedMs)) {
        bucket.elapsed.push(response.elapsedMs);
      }
      if (response.kind === "best_worst" && response.bestOptionId && response.worstOptionId) {
        bucket.best.set(response.bestOptionId, (bucket.best.get(response.bestOptionId) ?? 0) + 1);
        bucket.worst.set(response.worstOptionId, (bucket.worst.get(response.worstOptionId) ?? 0) + 1);
        if (safePosition(response.bestPresentedIndex)) bucket.bestPositions[response.bestPresentedIndex] += 1;
        if (safePosition(response.worstPresentedIndex)) bucket.worstPositions[response.worstPresentedIndex] += 1;
      } else if (response.kind === "intensity" && response.rating !== null) {
        bucket.ratings.push(response.rating);
      } else if (response.kind === "single_choice" && response.optionId) {
        bucket.chosen.set(response.optionId, (bucket.chosen.get(response.optionId) ?? 0) + 1);
        if (safePosition(response.presentedIndex)) bucket.positions[response.presentedIndex] += 1;
      }
    }
  }

  return SPEC_TEST_ITEMS_V3_PILOT.map((item): PilotItemAnalytics => {
    const bucket = buckets.get(item.id) as ItemBucket;
    const total = bucket.answered + bucket.skipped;
    const base: PilotItemAnalyticsBase = {
      itemId: item.id,
      prompt: item.prompt,
      answeredCount: bucket.answered,
      skippedCount: bucket.skipped,
      skipRate: total > 0 ? bucket.skipped / total : 0,
      medianElapsedMs: median(bucket.elapsed) ?? 0,
    };
    if (item.kind === "best_worst") {
      return {
        ...base,
        kind: "best_worst",
        bestPositionCounts: bucket.bestPositions,
        worstPositionCounts: bucket.worstPositions,
        options: item.options.map((option) => {
          const bestCount = bucket.best.get(option.id) ?? 0;
          const worstCount = bucket.worst.get(option.id) ?? 0;
          const bestRate = bucket.answered > 0 ? bestCount / bucket.answered : 0;
          const worstRate = bucket.answered > 0 ? worstCount / bucket.answered : 0;
          return {
            optionId: option.id,
            label: option.label,
            bestCount,
            bestRate,
            worstCount,
            worstRate,
            netPreference: bestRate - worstRate,
          };
        }),
      };
    }
    if (item.kind === "intensity") {
      const ratingCounts = [1, 2, 3, 4, 5, 6, 7].map(
        (rating) => bucket.ratings.filter((value) => value === rating).length,
      ) as PilotIntensityItemAnalytics["ratingCounts"];
      return {
        ...base,
        kind: "intensity",
        ratingCounts,
        meanRating:
          bucket.ratings.length > 0
            ? bucket.ratings.reduce((sum, value) => sum + value, 0) / bucket.ratings.length
            : null,
        medianRating: median(bucket.ratings),
      };
    }
    return {
      ...base,
      kind: "single_choice",
      positionCounts: bucket.positions,
      options: item.options.map((option) => {
        const chosenCount = bucket.chosen.get(option.id) ?? 0;
        return {
          optionId: option.id,
          label: option.label,
          chosenCount,
          choiceRate: bucket.answered > 0 ? chosenCount / bucket.answered : 0,
        };
      }),
    };
  });
}

function combinedScore(profile: unknown, dimension: ScoringDimensionKey): number | null {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  const value = (profile as Record<string, unknown>)[dimension];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const combined = (value as Record<string, unknown>).combinedScore;
  return typeof combined === "number" && Number.isFinite(combined) ? combined : null;
}

const FUNNEL_MILESTONES = [0, 4, 8, 12, 16, 20, 24, 28] as const;

function funnelLabel(completedCount: number): string {
  if (completedCount === 0) return "Consented / started";
  if (completedCount === 16) return "Finished best–worst blocks";
  if (completedCount === 24) return "Finished intensity anchors";
  if (completedCount === 28) return "Submitted all questions";
  return `${completedCount} questions completed`;
}

export async function getSpecTestPilotAnalytics(
  instrumentVersion: string = V3_PILOT_INSTRUMENT_VERSION,
): Promise<SpecTestPilotAnalytics> {
  const [attempts, submissions] = await Promise.all([
    prisma.specTestPilotAttempt.findMany({
      where: { instrumentVersion },
      select: { highestCompletedIndex: true, completedAt: true },
    }),
    prisma.specTestPilotSubmission.findMany({
      where: { instrumentVersion },
      select: {
        responses: true,
        attractionProfile: true,
        qualityFlags: true,
        dataSplit: true,
      },
    }),
  ]);

  const startedAttempts = attempts.length;
  const completedSubmissions = submissions.length;
  const dataSplit = { development: 0, holdout: 0 };
  const qualityClean = { total: 0, development: 0, holdout: 0 };
  let qualityFlaggedSubmissions = 0;
  const qualityFlagCounts: Record<string, number> = {};
  for (const submission of submissions) {
    if (submission.dataSplit === "holdout") dataSplit.holdout += 1;
    else dataSplit.development += 1;
    if (submission.qualityFlags.length === 0) {
      qualityClean.total += 1;
      if (submission.dataSplit === "holdout") qualityClean.holdout += 1;
      else qualityClean.development += 1;
    } else {
      qualityFlaggedSubmissions += 1;
    }
    for (const flag of submission.qualityFlags) qualityFlagCounts[flag] = (qualityFlagCounts[flag] ?? 0) + 1;
  }

  const funnel = FUNNEL_MILESTONES.map((completedCount) => {
    const attemptsReached = attempts.filter(
      (attempt) => attempt.highestCompletedIndex >= completedCount || (completedCount === 28 && attempt.completedAt),
    ).length;
    return {
      completedCount,
      label: funnelLabel(completedCount),
      attemptsReached,
      reachRate: startedAttempts > 0 ? attemptsReached / startedAttempts : 0,
    };
  });

  // Quality-flagged rows remain in volume, funnel, split, and item diagnostics so problems
  // stay visible. They are excluded only from motive summaries that could later inform model
  // fitting, preventing rushed/heavily skipped attempts from moving prototype estimates.
  const analysisSubmissions = submissions.filter((submission) => submission.qualityFlags.length === 0);
  const motives = SCORING_DIMENSION_KEYS.map((dimension): PilotMotiveDistribution => {
    const values = analysisSubmissions
      .map((submission) => combinedScore(submission.attractionProfile, dimension))
      .filter((value): value is number => value !== null);
    const developmentValues = analysisSubmissions
      .filter((submission) => submission.dataSplit !== "holdout")
      .map((submission) => combinedScore(submission.attractionProfile, dimension))
      .filter((value): value is number => value !== null);
    const holdoutValues = analysisSubmissions
      .filter((submission) => submission.dataSplit === "holdout")
      .map((submission) => combinedScore(submission.attractionProfile, dimension))
      .filter((value): value is number => value !== null);
    const distribution = stats(values);
    return {
      dimension,
      label: dimensionLabel(dimension),
      count: values.length,
      ...distribution,
      developmentMean: stats(developmentValues).mean,
      holdoutMean: stats(holdoutValues).mean,
    };
  });

  return {
    instrumentVersion,
    startedAttempts,
    completedSubmissions,
    completionRate: startedAttempts > 0 ? completedSubmissions / startedAttempts : 0,
    dataSplit,
    qualityClean,
    qualityFlaggedSubmissions,
    qualityFlagCounts,
    funnel,
    motives,
    items: buildItemAnalytics(submissions),
  };
}
