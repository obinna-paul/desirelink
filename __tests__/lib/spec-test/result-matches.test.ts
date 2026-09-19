jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findMany: jest.fn() },
    specTestResult: { findUnique: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  explainResultMatch,
  getResultMatchShortlist,
} from "@/lib/spec-test/result-matches";
import { LENS_KEYS, SCORING_DIMENSION_KEYS } from "@/lib/spec-test/taxonomy";
import type { SpecVectorResult } from "@/lib/spec-test/vector-compatibility";

const mockFindMany = prisma.profile.findMany as jest.Mock;
const mockFindResult = prisma.specTestResult.findUnique as jest.Mock;

function vectorResult(value: number): SpecVectorResult {
  return {
    specType: "grounded_equal",
    motiveScores: {
      motives: Object.fromEntries(
        SCORING_DIMENSION_KEYS
          .filter((key) => key !== "containedDepthPrivacy" && key !== "aestheticSelectivity")
          .map((key) => [key, value]),
      ),
      facets: { containedDepthPrivacy: value, aestheticSelectivity: value },
    },
    lenses: Object.fromEntries(LENS_KEYS.map((key) => [key, value])),
    attachment: { anxiety: value, avoidance: value },
  };
}

function candidate(id: string, value: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    username: id,
    displayName: `Person ${id}`,
    avatarUrl: "",
    bannerUrl: "",
    city: "Lagos",
    country: "Nigeria",
    showExactLocation: false,
    isVerified: false,
    isVerifiedCreator: false,
    locationLat: 6.5,
    locationLng: 3.3,
    matchPriority: "PARTNERSHIP",
    availabilityStatuses: [],
    specTestResults: [vectorResult(value)],
    ...overrides,
  };
}

const viewer = {
  resultId: "result-1",
  profileId: "viewer-1",
  locationLat: 6.5,
  locationLng: 3.3,
  priority: "PARTNERSHIP" as const,
  specResult: vectorResult(70),
};

describe("getResultMatchShortlist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindResult.mockResolvedValue({ profileId: null });
  });

  it("counts every qualifying match but returns only the top three read-only previews", async () => {
    mockFindMany.mockResolvedValue([
      candidate("one", 70, { availabilityStatuses: [{ status: "available_tonight" }] }),
      candidate("two", 70),
      candidate("three", 70),
      candidate("four", 70),
    ]);

    const result = await getResultMatchShortlist(viewer);

    expect(result.count).toBe(4);
    expect(result.profiles).toHaveLength(3);
    expect(result.profiles[0]).toMatchObject({
      id: "one",
      distanceKm: 0,
      explanation: "You both value emotional steadiness.",
    });
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        isIncognito: false,
        showInSearch: true,
        isSuspended: false,
        NOT: { id: "viewer-1" },
        blocksReceived: { none: { blockerId: "viewer-1" } },
        blocksMade: { none: { blockedId: "viewer-1" } },
      }),
      take: 1000,
    }));
  });

  it("returns no previews when no candidate clears the reciprocal threshold", async () => {
    mockFindMany.mockResolvedValue([candidate("opposed", 0)]);

    await expect(getResultMatchShortlist(viewer)).resolves.toEqual({ count: 0, profiles: [] });
  });

  it("excludes the linked result owner even when the result page viewer is signed out", async () => {
    mockFindResult.mockResolvedValue({ profileId: "owner-1" });
    mockFindMany.mockResolvedValue([]);

    await getResultMatchShortlist({ ...viewer, profileId: null });

    expect(mockFindMany.mock.calls[0][0].where).toMatchObject({
      NOT: { id: "owner-1" },
      blocksReceived: { none: { blockerId: "owner-1" } },
      blocksMade: { none: { blockedId: "owner-1" } },
    });
  });

  it("falls back to the original result ending if candidate retrieval fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockFindMany.mockRejectedValue(new Error("database unavailable"));

    await expect(getResultMatchShortlist(viewer)).resolves.toEqual({ count: 0, profiles: [] });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("explainResultMatch", () => {
  it("mentions a nearby live Spark fit only when all three facts are present", () => {
    expect(explainResultMatch(
      vectorResult(70),
      vectorResult(70),
      "SPARK",
      0.9,
      12,
      "available_tonight",
    )).toBe("Strong Spark alignment and currently available nearby.");
  });

  it("describes aligned communication preferences without claiming a personality trait", () => {
    expect(explainResultMatch(
      vectorResult(50),
      vectorResult(50),
      "BALANCED",
      0.8,
      null,
      null,
    )).toBe("You prefer a similar communication rhythm.");
  });
});
