import type { SpecTestPilotAnalytics } from "@/lib/spec-test/pilot-analytics";

/**
 * Predeclared v3 pilot review rules. Keep these versioned with the instrument and change
 * them only in a new pilot version: moving a threshold after looking at results turns a
 * decision rule into an outcome-driven judgment.
 */
export const V3_PILOT_REVIEW_THRESHOLDS = {
  minimumCleanTotal: 375,
  minimumCleanDevelopment: 300,
  minimumCleanHoldout: 75,
  operationalGateMinimumN: 50,
  minimumCompletionRate: 0.7,
  maximumFlaggedSubmissionRate: 0.15,
  itemWarningMinimumN: 30,
  positionWarningMinimumN: 40,
  maximumSkipRate: 0.1,
  maximumOptionRate: 0.55,
  maximumPositionRate: 0.4,
  maximumEndpointRate: 0.4,
  motiveVarianceMinimumN: 50,
  minimumMotiveStandardDeviation: 0.15,
  driftMinimumDevelopmentN: 30,
  driftMinimumHoldoutN: 20,
  maximumDevelopmentHoldoutMeanDifference: 0.35,
} as const;

export type PilotReviewGate = {
  id: string;
  label: string;
  state: "pending" | "pass" | "fail";
  current: string;
  target: string;
  detail: string;
};

export type PilotReviewWarning = {
  id: string;
  category: "item" | "position" | "distribution" | "holdout";
  title: string;
  detail: string;
};

export type SpecTestPilotReview = {
  status: "collecting" | "review_required" | "ready_for_modeling";
  gates: PilotReviewGate[];
  warnings: PilotReviewWarning[];
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

function sampleGate(id: string, label: string, current: number, target: number): PilotReviewGate {
  const reached = current >= target;
  return {
    id,
    label,
    state: reached ? "pass" : "pending",
    current: String(current),
    target: `At least ${target}`,
    detail: reached
      ? "Target reached; the remaining quality and stability checks still apply."
      : `${target - current} more quality-clean submissions needed.`,
  };
}

export function reviewSpecTestPilot(analytics: SpecTestPilotAnalytics): SpecTestPilotReview {
  const t = V3_PILOT_REVIEW_THRESHOLDS;
  const completionCanBeJudged = analytics.startedAttempts >= t.operationalGateMinimumN;
  const qualityCanBeJudged = analytics.completedSubmissions >= t.operationalGateMinimumN;
  const flaggedRate =
    analytics.completedSubmissions > 0
      ? analytics.qualityFlaggedSubmissions / analytics.completedSubmissions
      : 0;

  const gates: PilotReviewGate[] = [
    sampleGate("clean_total", "Quality-clean total sample", analytics.qualityClean.total, t.minimumCleanTotal),
    sampleGate(
      "clean_development",
      "Quality-clean development sample",
      analytics.qualityClean.development,
      t.minimumCleanDevelopment,
    ),
    sampleGate(
      "clean_holdout",
      "Untouched quality-clean hold-out sample",
      analytics.qualityClean.holdout,
      t.minimumCleanHoldout,
    ),
    {
      id: "completion_rate",
      label: "Pilot completion rate",
      state: !completionCanBeJudged
        ? "pending"
        : analytics.completionRate >= t.minimumCompletionRate
          ? "pass"
          : "fail",
      current: percent(analytics.completionRate),
      target: `At least ${percent(t.minimumCompletionRate)} after ${t.operationalGateMinimumN} starts`,
      detail: completionCanBeJudged
        ? "Measured from consented starts to saved complete submissions."
        : `${t.operationalGateMinimumN - analytics.startedAttempts} more starts needed before judging completion.`,
    },
    {
      id: "quality_rate",
      label: "Flagged-submission rate",
      state: !qualityCanBeJudged
        ? "pending"
        : flaggedRate <= t.maximumFlaggedSubmissionRate
          ? "pass"
          : "fail",
      current: percent(flaggedRate),
      target: `At most ${percent(t.maximumFlaggedSubmissionRate)} after ${t.operationalGateMinimumN} submissions`,
      detail: qualityCanBeJudged
        ? `${analytics.qualityFlaggedSubmissions} of ${analytics.completedSubmissions} submissions have one or more quality flags.`
        : `${t.operationalGateMinimumN - analytics.completedSubmissions} more submissions needed before judging response quality.`,
    },
  ];

  const warnings: PilotReviewWarning[] = [];
  for (const item of analytics.items) {
    const itemTotal = item.answeredCount + item.skippedCount;
    if (itemTotal >= t.itemWarningMinimumN && item.skipRate > t.maximumSkipRate) {
      warnings.push({
        id: `${item.itemId}:skip`,
        category: "item",
        title: `${item.itemId} has elevated skipping`,
        detail: `${percent(item.skipRate)} skipped; the predeclared warning threshold is above ${percent(t.maximumSkipRate)}.`,
      });
    }
    if (item.answeredCount < t.itemWarningMinimumN) continue;

    if (item.kind === "best_worst") {
      for (const option of item.options) {
        if (option.bestRate > t.maximumOptionRate) {
          warnings.push({
            id: `${item.itemId}:${option.optionId}:most`,
            category: "item",
            title: `${item.itemId} has a dominant “most” option`,
            detail: `“${option.label}” was selected most by ${percent(option.bestRate)}; review desirability or wording imbalance.`,
          });
        }
        if (option.worstRate > t.maximumOptionRate) {
          warnings.push({
            id: `${item.itemId}:${option.optionId}:least`,
            category: "item",
            title: `${item.itemId} has a dominant “least” option`,
            detail: `“${option.label}” was selected least by ${percent(option.worstRate)}; review desirability or wording imbalance.`,
          });
        }
      }
      if (item.answeredCount >= t.positionWarningMinimumN) {
        const bestMax = Math.max(...item.bestPositionCounts) / item.answeredCount;
        const worstMax = Math.max(...item.worstPositionCounts) / item.answeredCount;
        if (bestMax > t.maximumPositionRate || worstMax > t.maximumPositionRate) {
          warnings.push({
            id: `${item.itemId}:position`,
            category: "position",
            title: `${item.itemId} may have a presentation-position effect`,
            detail: `The largest position share is ${percent(Math.max(bestMax, worstMax))}; four randomized positions should not exceed ${percent(t.maximumPositionRate)} without review.`,
          });
        }
      }
    } else if (item.kind === "single_choice") {
      for (const option of item.options) {
        if (option.choiceRate > t.maximumOptionRate) {
          warnings.push({
            id: `${item.itemId}:${option.optionId}:choice`,
            category: "item",
            title: `${item.itemId} has a dominant response`,
            detail: `“${option.label}” was selected by ${percent(option.choiceRate)}; review keying and social desirability.`,
          });
        }
      }
      if (item.answeredCount >= t.positionWarningMinimumN) {
        const positionMax = Math.max(...item.positionCounts) / item.answeredCount;
        if (positionMax > t.maximumPositionRate) {
          warnings.push({
            id: `${item.itemId}:position`,
            category: "position",
            title: `${item.itemId} may have a presentation-position effect`,
            detail: `One randomized position accounts for ${percent(positionMax)} of responses; the threshold is ${percent(t.maximumPositionRate)}.`,
          });
        }
      }
    } else {
      const lowEndpointRate = item.ratingCounts[0] / item.answeredCount;
      const highEndpointRate = item.ratingCounts[6] / item.answeredCount;
      if (lowEndpointRate > t.maximumEndpointRate || highEndpointRate > t.maximumEndpointRate) {
        warnings.push({
          id: `${item.itemId}:endpoint`,
          category: "distribution",
          title: `${item.itemId} has an endpoint pile-up`,
          detail: `Rating 1 is ${percent(lowEndpointRate)} and rating 7 is ${percent(highEndpointRate)}; review scale anchoring and desirability.`,
        });
      }
    }
  }

  for (const motive of analytics.motives) {
    if (
      motive.count >= t.motiveVarianceMinimumN &&
      motive.standardDeviation !== null &&
      motive.standardDeviation < t.minimumMotiveStandardDeviation
    ) {
      warnings.push({
        id: `${motive.dimension}:compression`,
        category: "distribution",
        title: `${motive.label} scores are compressed`,
        detail: `SD is ${motive.standardDeviation.toFixed(2)}; below ${t.minimumMotiveStandardDeviation.toFixed(2)} may not separate respondents reliably.`,
      });
    }
    if (
      analytics.qualityClean.development >= t.driftMinimumDevelopmentN &&
      analytics.qualityClean.holdout >= t.driftMinimumHoldoutN &&
      motive.developmentMean !== null &&
      motive.holdoutMean !== null
    ) {
      const difference = Math.abs(motive.developmentMean - motive.holdoutMean);
      if (difference >= t.maximumDevelopmentHoldoutMeanDifference) {
        warnings.push({
          id: `${motive.dimension}:holdout_drift`,
          category: "holdout",
          title: `${motive.label} differs between development and hold-out`,
          detail: `Absolute mean difference is ${difference.toFixed(2)} on the −1 to 1 scale; investigate sampling or instability without retuning to the hold-out set.`,
        });
      }
    }
  }

  const allGatesPass = gates.every((gate) => gate.state === "pass");
  const anyGateFailed = gates.some((gate) => gate.state === "fail");
  return {
    status:
      anyGateFailed || warnings.length > 0
        ? "review_required"
        : allGatesPass
          ? "ready_for_modeling"
          : "collecting",
    gates,
    warnings,
  };
}
