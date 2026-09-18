import { reviewSpecTestPilot } from "@/lib/spec-test/pilot-review";
import type { SpecTestPilotAnalytics } from "@/lib/spec-test/pilot-analytics";

function analytics(overrides: Partial<SpecTestPilotAnalytics> = {}): SpecTestPilotAnalytics {
  return {
    instrumentVersion: "spec-v3-pilot.1",
    startedAttempts: 0,
    completedSubmissions: 0,
    completionRate: 0,
    dataSplit: { development: 0, holdout: 0 },
    qualityClean: { total: 0, development: 0, holdout: 0 },
    qualityFlaggedSubmissions: 0,
    qualityFlagCounts: {},
    funnel: [],
    motives: [],
    items: [],
    ...overrides,
  };
}

describe("reviewSpecTestPilot", () => {
  it("keeps operational rates pending until their predefined minimum sample", () => {
    const review = reviewSpecTestPilot(
      analytics({ startedAttempts: 49, completedSubmissions: 40, completionRate: 0.2 }),
    );
    expect(review.status).toBe("collecting");
    expect(review.gates.find((gate) => gate.id === "completion_rate")?.state).toBe("pending");
    expect(review.gates.find((gate) => gate.id === "quality_rate")?.state).toBe("pending");
  });

  it("fails operational gates only after enough observations", () => {
    const review = reviewSpecTestPilot(
      analytics({
        startedAttempts: 100,
        completedSubmissions: 60,
        completionRate: 0.6,
        qualityClean: { total: 45, development: 36, holdout: 9 },
        qualityFlaggedSubmissions: 15,
      }),
    );
    expect(review.status).toBe("review_required");
    expect(review.gates.find((gate) => gate.id === "completion_rate")?.state).toBe("fail");
    expect(review.gates.find((gate) => gate.id === "quality_rate")?.state).toBe("fail");
  });

  it("flags dominant wording, position effects, endpoint pile-ups, compression, and hold-out drift", () => {
    const review = reviewSpecTestPilot(
      analytics({
        startedAttempts: 500,
        completedSubmissions: 375,
        completionRate: 0.75,
        qualityClean: { total: 375, development: 300, holdout: 75 },
        qualityFlaggedSubmissions: 0,
        motives: [
          {
            dimension: "warmthResponsiveness",
            label: "Warmth & Responsiveness",
            count: 300,
            mean: 0.1,
            standardDeviation: 0.1,
            minimum: -0.1,
            maximum: 0.3,
            developmentMean: 0,
            holdoutMean: 0.4,
          },
        ],
        items: [
          {
            itemId: "block",
            prompt: "Prompt",
            kind: "best_worst",
            answeredCount: 40,
            skippedCount: 0,
            skipRate: 0,
            medianElapsedMs: 1000,
            bestPositionCounts: [20, 8, 6, 6],
            worstPositionCounts: [10, 10, 10, 10],
            options: [
              { optionId: "a", label: "A", bestCount: 24, bestRate: 0.6, worstCount: 4, worstRate: 0.1, netPreference: 0.5 },
            ],
          },
          {
            itemId: "intensity",
            prompt: "Prompt",
            kind: "intensity",
            answeredCount: 40,
            skippedCount: 0,
            skipRate: 0,
            medianElapsedMs: 1000,
            ratingCounts: [0, 0, 0, 0, 0, 0, 40],
            meanRating: 7,
            medianRating: 7,
          },
        ],
      }),
    );
    expect(review.warnings.map((warning) => warning.id)).toEqual(
      expect.arrayContaining([
        "block:a:most",
        "block:position",
        "intensity:endpoint",
        "warmthResponsiveness:compression",
        "warmthResponsiveness:holdout_drift",
      ]),
    );
    expect(review.status).toBe("review_required");
  });

  it("reports ready for modeling only when every gate passes and no warning fires", () => {
    const review = reviewSpecTestPilot(
      analytics({
        startedAttempts: 500,
        completedSubmissions: 400,
        completionRate: 0.8,
        qualityClean: { total: 375, development: 300, holdout: 75 },
        qualityFlaggedSubmissions: 20,
      }),
    );
    expect(review.gates.every((gate) => gate.state === "pass")).toBe(true);
    expect(review.status).toBe("ready_for_modeling");
  });
});
