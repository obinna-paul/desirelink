import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import {
  analyzeScoreSpace,
  analyzeSingleAnswerPerturbations,
  buildScoringLaboratoryReport,
  searchArchetypeReachability,
  searchV22ArchetypeReachability,
  simulateNullDistribution,
  simulateV22NullDecisions,
} from "@/lib/spec-test/scoring/diagnostics";
import { ARCHETYPE_KEYS, SCORING_DIMENSION_KEYS } from "@/lib/spec-test/taxonomy";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";

describe("Spec Test scoring laboratory", () => {
  it("proves the current response-space invariant from the real item bank", () => {
    const result = analyzeScoreSpace(SPEC_TEST_ITEMS_V2);

    expect(result.scoredItemCount).toBe(20);
    expect(result.equalWeightedExposure).toBe(true);
    expect(result.totalChosenWeight).toBeCloseTo(22.6);
    expect(result.completeResponseScoreSum).toBeCloseTo(200);
    expect(result.completeResponseScoreMean).toBeCloseTo(25);

    for (const dimension of SCORING_DIMENSION_KEYS) {
      expect(result.dimensionExposure[dimension]).toEqual({ itemCount: 10, weightedExposure: 11.3 });
      expect(result.nullExpectedVector[dimension]).toBeCloseTo(25);
    }
    expect(result.centroidLevels.grounded_equal.mean).toBeCloseTo(45.625);
    expect(result.centroidLevels.brilliant_tease.mean).toBeCloseTo(57.5);
  });

  it("reproduces the null-distribution collapse deterministically", () => {
    const first = simulateNullDistribution(SPEC_TEST_ITEMS_V2, { samples: 5_000, seed: 42 });
    const second = simulateNullDistribution(SPEC_TEST_ITEMS_V2, { samples: 5_000, seed: 42 });

    expect(second).toEqual(first);
    expect(first.largestWinner).toBe("grounded_equal");
    expect(first.largestWinnerShare).toBeGreaterThan(0.4);
    expect(first.winnerShares.ambitious_icon).toBeLessThan(0.01);
    expect(first.winnerShares.brilliant_tease).toBeLessThan(0.01);
  });

  it("searches for every archetype through valid response patterns, never raw centroid injection", () => {
    const results = ARCHETYPE_KEYS.map((archetype) =>
      searchArchetypeReachability(SPEC_TEST_ITEMS_V2, archetype, { restarts: 12, seed: 7 }),
    );

    for (const result of results) {
      expect(result.optionIds).toHaveLength(20);
      expect(result.targetRank).toBeGreaterThanOrEqual(1);
      expect(result.targetRank).toBeLessThanOrEqual(ARCHETYPE_KEYS.length);
    }
  });

  it("measures one-answer winner stability from a valid response-derived archetype pattern", () => {
    const pattern = searchArchetypeReachability(SPEC_TEST_ITEMS_V2, "electric_charmer", {
      restarts: 12,
      seed: 11,
    });
    const scoredItems = SPEC_TEST_ITEMS_V2.filter((item) =>
      item.options.some((option) => pattern.optionIds.includes(option.id)),
    );
    const responses: SpecTestResponseV2[] = scoredItems.map((item) => {
      const optionId = pattern.optionIds.find((candidate) => item.options.some((option) => option.id === candidate));
      if (!optionId) throw new Error(`missing response for ${item.id}`);
      return { itemId: item.id, optionId, presentedIndex: 0, elapsedMs: 3_000 };
    });

    const stability = analyzeSingleAnswerPerturbations(scoredItems, responses);
    expect(stability.baselineWinner).toBe(pattern.winner);
    expect(stability.trials).toBe(60);
    expect(stability.winnerChangeRate).toBeGreaterThanOrEqual(0);
    expect(stability.winnerChangeRate).toBeLessThanOrEqual(1);
  });

  it("raises explicit health flags instead of silently treating the current geometry as valid", () => {
    const report = buildScoringLaboratoryReport(SPEC_TEST_ITEMS_V2, {
      nullSamples: 5_000,
      reachabilityRestarts: 12,
      seed: 42,
    });

    expect(report.legacyHealthFlags).toContain("score_space_baseline_mismatch");
    expect(report.legacyHealthFlags).toContain("null_distribution_collapse");
    expect(report.v22HealthFlags).toEqual([]);

    if (process.env.SPEC_TEST_AUDIT_REPORT === "1") {
      console.info(
        "\nSPEC TEST SCORING LABORATORY\n" +
          JSON.stringify(
            {
              legacyHealthFlags: report.legacyHealthFlags,
              v22HealthFlags: report.v22HealthFlags,
              scoreSpace: {
                scoredItemCount: report.scoreSpace.scoredItemCount,
                dimensionExposure: report.scoreSpace.dimensionExposure,
                completeResponseScoreSum: report.scoreSpace.completeResponseScoreSum,
                completeResponseScoreMean: report.scoreSpace.completeResponseScoreMean,
                centroidLevels: report.scoreSpace.centroidLevels,
                maxCentroidBaselineGap: report.scoreSpace.maxCentroidBaselineGap,
              },
              nullSimulation: {
                samples: report.nullSimulation.samples,
                seed: report.nullSimulation.seed,
                largestWinner: report.nullSimulation.largestWinner,
                largestWinnerShare: report.nullSimulation.largestWinnerShare,
                winnerShares: report.nullSimulation.winnerShares,
              },
              v22NullDecisions: report.v22NullDecisions,
              reachability: report.reachability.map((result) => ({
                archetype: result.archetype,
                reachable: result.reachable,
                winner: result.winner,
                targetRank: result.targetRank,
                classificationMargin: result.classificationMargin,
              })),
              v22Reachability: report.v22Reachability.map((result) => ({
                archetype: result.archetype,
                reachable: result.reachable,
                winner: result.winner,
                targetRank: result.targetRank,
                targetEvidence: result.targetEvidence,
                classificationMargin: result.classificationMargin,
              })),
            },
            null,
            2,
          ),
      );
    }
  });

  it("sends most random response patterns to low signal under the v2.2 decision gate", () => {
    const result = simulateV22NullDecisions(SPEC_TEST_ITEMS_V2, { samples: 2_000, seed: 42 });
    expect(result.lowSignalRate).toBeGreaterThan(0.8);
    expect(result.confidenceCounts.split).toBe(0);
  });

  it("finds a usable valid-answer pattern for every archetype under v2.2", () => {
    const results = ARCHETYPE_KEYS.map((archetype) =>
      searchV22ArchetypeReachability(SPEC_TEST_ITEMS_V2, archetype, { restarts: 12, seed: 42 }),
    );
    for (const result of results) {
      expect(result.reachable).toBe(true);
      expect(result.winner).toBe(result.archetype);
      expect(result.targetEvidence).toBeGreaterThanOrEqual(2.25);
    }
  });
});
