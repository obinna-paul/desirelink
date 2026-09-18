jest.mock("@/lib/prisma", () => ({
  prisma: {
    specTestResult: { groupBy: jest.fn() },
    specTestInstrumentStat: { findUnique: jest.fn() },
    specTestFormStat: { findUnique: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getSpecTestConfidenceMix,
  getSpecTestConfidenceMixByForm,
  getSpecTestTypeDistribution,
  getSpecTestTypeDistributionByForm,
} from "@/lib/spec-test/admin-stats";
import { SPEC_TYPE_READINGS } from "@/lib/spec-test/legacy";

const mockPrisma = prisma as unknown as {
  specTestResult: { groupBy: jest.Mock };
  specTestInstrumentStat: { findUnique: jest.Mock };
  specTestFormStat: { findUnique: jest.Mock };
};

describe("getSpecTestTypeDistribution", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps each archetype key to its display name and count", async () => {
    mockPrisma.specTestResult.groupBy.mockResolvedValue([
      { specType: "quiet_fire", _count: { _all: 12 } },
      { specType: "grounded_equal", _count: { _all: 7 } },
    ]);

    const rows = await getSpecTestTypeDistribution("spec-v2.1");

    expect(mockPrisma.specTestResult.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { instrumentVersion: "spec-v2.1" } }),
    );

    expect(rows.slice(0, 2)).toEqual([
      { specType: "quiet_fire", name: SPEC_TYPE_READINGS.quiet_fire.name, count: 12 },
      { specType: "grounded_equal", name: SPEC_TYPE_READINGS.grounded_equal.name, count: 7 },
    ]);
    expect(rows).toHaveLength(8);
    expect(rows.find((row) => row.specType === "electric_charmer")?.count).toBe(0);
  });

  it("falls back to the raw key for an unrecognized specType rather than throwing", async () => {
    mockPrisma.specTestResult.groupBy.mockResolvedValue([{ specType: "mystery_key", _count: { _all: 1 } }]);
    const rows = await getSpecTestTypeDistribution("spec-v2.1");
    expect(rows.find((row) => row.specType === "mystery_key")).toEqual({
      specType: "mystery_key",
      name: "mystery_key",
      count: 1,
    });
  });
});

describe("getSpecTestConfidenceMix", () => {
  beforeEach(() => jest.clearAllMocks());

  it("computes rates including a real low-signal rate from the counter table", async () => {
    mockPrisma.specTestResult.groupBy.mockResolvedValue([
      { resultConfidence: "clear", _count: { _all: 60 } },
      { resultConfidence: "blend", _count: { _all: 30 } },
      { resultConfidence: "split", _count: { _all: 10 } },
    ]);
    mockPrisma.specTestInstrumentStat.findUnique.mockResolvedValue({
      instrumentVersion: "spec-v2.0",
      submittedCount: 100,
      lowSignalCount: 20,
    });

    const mix = await getSpecTestConfidenceMix("spec-v2.0");

    expect(mix.clear).toBe(60);
    expect(mix.blend).toBe(30);
    expect(mix.split).toBe(10);
    expect(mix.lowSignal).toBe(20);
    expect(mix.totalAttempts).toBe(120);
    expect(mix.rates.clear).toBeCloseTo(60 / 120);
    expect(mix.rates.low_signal).toBeCloseTo(20 / 120);
  });

  it("returns all-zero rates without dividing by zero when nothing has been submitted yet", async () => {
    mockPrisma.specTestResult.groupBy.mockResolvedValue([]);
    mockPrisma.specTestInstrumentStat.findUnique.mockResolvedValue(null);

    const mix = await getSpecTestConfidenceMix("spec-v2.0");

    expect(mix.totalAttempts).toBe(0);
    expect(mix.rates).toEqual({ clear: 0, blend: 0, split: 0, low_signal: 0 });
  });
});

describe("getSpecTestConfidenceMixByForm (gender plan Phase G6)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("computes an independent mix per quizForm, using SpecTestFormStat for each form's low-signal count", async () => {
    mockPrisma.specTestResult.groupBy.mockImplementation(({ where }: { where: { quizForm: string } }) => {
      if (where.quizForm === "male_user") {
        return Promise.resolve([
          { resultConfidence: "clear", _count: { _all: 40 } },
          { resultConfidence: "blend", _count: { _all: 10 } },
        ]);
      }
      return Promise.resolve([{ resultConfidence: "clear", _count: { _all: 5 } }]);
    });
    mockPrisma.specTestFormStat.findUnique.mockImplementation(({ where }: { where: { instrumentVersion_quizForm: { quizForm: string } } }) => {
      if (where.instrumentVersion_quizForm.quizForm === "male_user") {
        return Promise.resolve({ lowSignalCount: 10 });
      }
      return Promise.resolve(null);
    });

    const [maleUser, femaleUser] = await getSpecTestConfidenceMixByForm("spec-v2.1");

    expect(maleUser.quizForm).toBe("male_user");
    expect(maleUser.clear).toBe(40);
    expect(maleUser.blend).toBe(10);
    expect(maleUser.lowSignal).toBe(10);
    expect(maleUser.totalAttempts).toBe(60);
    expect(maleUser.rates.clear).toBeCloseTo(40 / 60);

    expect(femaleUser.quizForm).toBe("female_user");
    expect(femaleUser.clear).toBe(5);
    expect(femaleUser.lowSignal).toBe(0);
    expect(femaleUser.totalAttempts).toBe(5);
  });
});

describe("getSpecTestTypeDistributionByForm (gender plan Phase G6)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("groups the type distribution separately for each quizForm", async () => {
    mockPrisma.specTestResult.groupBy.mockImplementation(
      ({ where }: { where: { instrumentVersion: string; quizForm: string } }) => {
        expect(where.instrumentVersion).toBe("spec-v2.1");
        if (where.quizForm === "male_user") {
          return Promise.resolve([{ specType: "quiet_fire", _count: { _all: 3 } }]);
        }
        return Promise.resolve([{ specType: "grounded_equal", _count: { _all: 2 } }]);
      },
    );

    const [maleUser, femaleUser] = await getSpecTestTypeDistributionByForm("spec-v2.1");

    expect(maleUser.quizForm).toBe("male_user");
    expect(maleUser.rows.find((row) => row.specType === "quiet_fire")).toEqual({
      specType: "quiet_fire",
      name: SPEC_TYPE_READINGS.quiet_fire.name,
      count: 3,
    });
    expect(maleUser.rows.find((row) => row.specType === "electric_charmer")?.count).toBe(0);
    expect(femaleUser.quizForm).toBe("female_user");
    expect(femaleUser.rows.find((row) => row.specType === "grounded_equal")).toEqual({
      specType: "grounded_equal",
      name: SPEC_TYPE_READINGS.grounded_equal.name,
      count: 2,
    });
  });
});
