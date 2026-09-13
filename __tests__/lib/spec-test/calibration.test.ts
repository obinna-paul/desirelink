jest.mock("@/lib/prisma", () => ({
  prisma: {
    specTestResult: { findMany: jest.fn(), groupBy: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getSpecTestDataSplitCounts, getSpecTestItemAnalytics } from "@/lib/spec-test/calibration";
import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { INSTRUMENT_VERSION } from "@/lib/spec-test/taxonomy";

const mockPrisma = prisma as unknown as {
  specTestResult: { findMany: jest.Mock; groupBy: jest.Mock };
};

const firstItem = SPEC_TEST_ITEMS_V2[0];
const secondItem = SPEC_TEST_ITEMS_V2[1];

describe("getSpecTestItemAnalytics", () => {
  beforeEach(() => jest.clearAllMocks());

  it("aggregates choice frequency, position counts, skip rate and median elapsed time per item", async () => {
    mockPrisma.specTestResult.findMany.mockResolvedValue([
      {
        answers: [
          { itemId: firstItem.id, optionId: firstItem.options[0].id, presentedIndex: 0, elapsedMs: 2000 },
          { itemId: secondItem.id, optionId: null, presentedIndex: null, elapsedMs: 0, skipped: true },
        ],
      },
      {
        answers: [
          { itemId: firstItem.id, optionId: firstItem.options[0].id, presentedIndex: 1, elapsedMs: 4000 },
          { itemId: secondItem.id, optionId: secondItem.options[2].id, presentedIndex: 2, elapsedMs: 3000 },
        ],
      },
      {
        answers: [
          { itemId: firstItem.id, optionId: firstItem.options[1].id, presentedIndex: 0, elapsedMs: 6000 },
        ],
      },
    ]);

    const analytics = await getSpecTestItemAnalytics(INSTRUMENT_VERSION);
    const first = analytics.find((row) => row.itemId === firstItem.id)!;
    const second = analytics.find((row) => row.itemId === secondItem.id)!;

    expect(first.answeredCount).toBe(3);
    expect(first.skippedCount).toBe(0);
    expect(first.medianElapsedMs).toBe(4000);
    expect(first.positionCounts[0]).toBe(2); // two answers presented at position 0
    expect(first.positionCounts[1]).toBe(1);
    const firstOptionStats = first.options.find((o) => o.optionId === firstItem.options[0].id)!;
    expect(firstOptionStats.chosenCount).toBe(2);
    expect(firstOptionStats.choiceRate).toBeCloseTo(2 / 3);

    expect(second.answeredCount).toBe(1);
    expect(second.skippedCount).toBe(1);
    expect(second.skipRate).toBeCloseTo(0.5);
  });

  it("returns a zeroed row for every item in the bank, even ones no response ever touched", async () => {
    mockPrisma.specTestResult.findMany.mockResolvedValue([]);
    const analytics = await getSpecTestItemAnalytics(INSTRUMENT_VERSION);
    expect(analytics).toHaveLength(SPEC_TEST_ITEMS_V2.length);
    for (const row of analytics) {
      expect(row.answeredCount).toBe(0);
      expect(row.skippedCount).toBe(0);
      expect(row.skipRate).toBe(0);
      expect(row.medianElapsedMs).toBe(0);
    }
  });

  it("ignores a malformed answers payload instead of throwing", async () => {
    mockPrisma.specTestResult.findMany.mockResolvedValue([{ answers: null }, { answers: "not-an-array" }]);
    await expect(getSpecTestItemAnalytics(INSTRUMENT_VERSION)).resolves.toHaveLength(SPEC_TEST_ITEMS_V2.length);
  });
});

describe("getSpecTestDataSplitCounts", () => {
  it("reports development and holdout counts, defaulting missing buckets to zero", async () => {
    mockPrisma.specTestResult.groupBy.mockResolvedValue([{ dataSplit: "development", _count: { _all: 80 } }]);
    const counts = await getSpecTestDataSplitCounts(INSTRUMENT_VERSION);
    expect(counts).toEqual({ development: 80, holdout: 0 });
  });
});
