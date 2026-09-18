jest.mock("@/lib/prisma", () => ({
  prisma: {
    specTestPilotAttempt: { findMany: jest.fn() },
    specTestPilotSubmission: { findMany: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getSpecTestPilotAnalytics } from "@/lib/spec-test/pilot-analytics";
import {
  SPEC_TEST_ITEMS_V3_PILOT,
  V3_PILOT_BEST_WORST_ITEMS,
  V3_PILOT_INTENSITY_ITEMS,
  V3_PILOT_UNCERTAINTY_ITEMS,
} from "@/lib/spec-test/items/spec-v3-pilot";

const mockPrisma = prisma as unknown as {
  specTestPilotAttempt: { findMany: jest.Mock };
  specTestPilotSubmission: { findMany: jest.Mock };
};

describe("getSpecTestPilotAnalytics", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports a real completion funnel, split monitoring, motive distributions, and item choices", async () => {
    mockPrisma.specTestPilotAttempt.findMany.mockResolvedValue([
      { highestCompletedIndex: 0, completedAt: null },
      { highestCompletedIndex: 16, completedAt: null },
      { highestCompletedIndex: 28, completedAt: new Date() },
    ]);
    const block = V3_PILOT_BEST_WORST_ITEMS[0];
    const anchor = V3_PILOT_INTENSITY_ITEMS[0];
    const uncertainty = V3_PILOT_UNCERTAINTY_ITEMS[0];
    mockPrisma.specTestPilotSubmission.findMany.mockResolvedValue([
      {
        dataSplit: "development",
        qualityFlags: ["too_fast"],
        attractionProfile: { warmthResponsiveness: { combinedScore: 0.2 } },
        responses: [
          { itemId: block.id, kind: "best_worst", bestOptionId: block.options[0].id, worstOptionId: block.options[1].id, bestPresentedIndex: 2, worstPresentedIndex: 1, elapsedMs: 3000 },
          { itemId: anchor.id, kind: "intensity", rating: 6, elapsedMs: 1800 },
          { itemId: uncertainty.id, kind: "single_choice", optionId: uncertainty.options[0].id, presentedIndex: 3, elapsedMs: 2200 },
        ],
      },
      {
        dataSplit: "holdout",
        qualityFlags: [],
        attractionProfile: { warmthResponsiveness: { combinedScore: 0.6 } },
        responses: [
          { itemId: block.id, kind: "best_worst", bestOptionId: block.options[0].id, worstOptionId: block.options[2].id, bestPresentedIndex: 0, worstPresentedIndex: 2, elapsedMs: 5000 },
          { itemId: anchor.id, kind: "intensity", rating: 4, elapsedMs: 2400 },
          { itemId: uncertainty.id, kind: "single_choice", optionId: uncertainty.options[1].id, presentedIndex: 1, elapsedMs: 2800 },
        ],
      },
    ]);

    const result = await getSpecTestPilotAnalytics();
    expect(result.startedAttempts).toBe(3);
    expect(result.completedSubmissions).toBe(2);
    expect(result.completionRate).toBeCloseTo(2 / 3);
    expect(result.dataSplit).toEqual({ development: 1, holdout: 1 });
    expect(result.qualityClean).toEqual({ total: 1, development: 0, holdout: 1 });
    expect(result.qualityFlaggedSubmissions).toBe(1);
    expect(result.qualityFlagCounts).toEqual({ too_fast: 1 });
    expect(result.funnel.find((point) => point.completedCount === 16)?.attemptsReached).toBe(2);
    expect(result.funnel.find((point) => point.completedCount === 28)?.attemptsReached).toBe(1);

    const warmth = result.motives.find((motive) => motive.dimension === "warmthResponsiveness")!;
    expect(warmth.count).toBe(1);
    expect(warmth.mean).toBeCloseTo(0.6);
    expect(warmth.developmentMean).toBeNull();
    expect(warmth.holdoutMean).toBeCloseTo(0.6);

    const blockAnalytics = result.items.find((item) => item.itemId === block.id)!;
    expect(blockAnalytics.kind).toBe("best_worst");
    if (blockAnalytics.kind === "best_worst") {
      expect(blockAnalytics.options[0].bestRate).toBe(1);
      expect(blockAnalytics.bestPositionCounts).toEqual([1, 0, 1, 0]);
    }
    const intensity = result.items.find((item) => item.itemId === anchor.id)!;
    expect(intensity.kind === "intensity" && intensity.meanRating).toBe(5);
  });

  it("returns zeroed diagnostics for every pilot item before recruitment starts", async () => {
    mockPrisma.specTestPilotAttempt.findMany.mockResolvedValue([]);
    mockPrisma.specTestPilotSubmission.findMany.mockResolvedValue([]);
    const result = await getSpecTestPilotAnalytics();
    expect(result.completionRate).toBe(0);
    expect(result.qualityClean).toEqual({ total: 0, development: 0, holdout: 0 });
    expect(result.items).toHaveLength(SPEC_TEST_ITEMS_V3_PILOT.length);
    expect(result.items.every((item) => item.answeredCount === 0)).toBe(true);
  });
});
