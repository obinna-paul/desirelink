jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findUnique: jest.fn(), findMany: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getPersonalizedRecommendations } from "@/lib/recommendations";
import { LENS_KEYS, SCORING_DIMENSION_KEYS } from "@/lib/spec-test/taxonomy";

const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock; findMany: jest.Mock };
};

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "viewer-1",
    locationLat: 0,
    locationLng: 0,
    city: "",
    country: "",
    openToChat: false,
    openToMeet: false,
    availabilityStatuses: [],
    specTestResults: [],
    ...overrides,
  };
}

function baseCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "candidate-1",
    username: "candidate",
    displayName: "Candidate",
    avatarUrl: "",
    bannerUrl: "",
    city: "",
    country: "",
    showExactLocation: false,
    profileType: "EXPLORER",
    serviceCategories: [],
    isVerified: false,
    isVerifiedCreator: false,
    isVerifiedServiceProvider: false,
    verificationPending: false,
    isTrustedMember: false,
    matchPriority: "BALANCED",
    availabilityStatuses: [],
    specShownPublicly: false,
    specTestResults: [],
    locationLat: 0,
    locationLng: 0,
    openToChat: false,
    openToMeet: false,
    updatedAt: new Date("2000-01-01"),
    ...overrides,
  };
}

function vectorResult(value: number) {
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

describe("getPersonalizedRecommendations - spec compatibility term", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fully boosts and explains a candidate whose Specs complement each other both ways", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(
      baseProfile({ specTestResults: [{ specType: "electric_charmer" }] }),
    );
    mockPrisma.profile.findMany.mockResolvedValue([
      baseCandidate({ id: "no-spec" }),
      baseCandidate({ id: "complement", specTestResults: [{ specType: "grounded_equal" }] }),
    ]);

    const results = await getPersonalizedRecommendations("user-1");

    expect(results).not.toBeNull();
    const complement = results!.find((r) => r.profile.id === "complement")!;
    const noSpec = results!.find((r) => r.profile.id === "no-spec")!;

    expect(complement.reasons).toContain("Your Specs complement each other");
    expect(complement.compatibilityScore).toBeGreaterThan(noSpec.compatibilityScore);
    // Electric Charmer and Grounded Equal list one another as their strongest complement,
    // so both directional scores are 1 and the full +15 is reflected.
    expect(complement.compatibilityScore - noSpec.compatibilityScore).toBe(15);
  });

  it("credits, but less than a true complement, when the candidate shares the viewer's own spec", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(
      baseProfile({ specTestResults: [{ specType: "grounded_equal" }] }),
    );
    mockPrisma.profile.findMany.mockResolvedValue([
      baseCandidate({ id: "same-spec", specTestResults: [{ specType: "grounded_equal" }] }),
      baseCandidate({ id: "complement", specTestResults: [{ specType: "electric_charmer" }] }),
    ]);

    const results = await getPersonalizedRecommendations("user-1");

    const sameSpec = results!.find((r) => r.profile.id === "same-spec")!;
    const complement = results!.find((r) => r.profile.id === "complement")!;

    expect(sameSpec.reasons).toContain("Shares your spec");
    expect(sameSpec.compatibilityScore).toBeLessThan(complement.compatibilityScore);
    expect(sameSpec.compatibilityScore).toBeGreaterThan(0);
  });

  it("never penalizes a candidate, or the viewer, for not having taken the test", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(baseProfile({ specTestResults: [] }));
    mockPrisma.profile.findMany.mockResolvedValue([baseCandidate({ specTestResults: [] })]);

    const results = await getPersonalizedRecommendations("user-1");

    expect(results![0].reasons).not.toContain("Your Specs complement each other");
    expect(results![0].reasons).not.toContain("Shares your spec");
  });

  it("uses full vectors before archetype labels and explains the alignment", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(
      baseProfile({ specTestResults: [vectorResult(70)] }),
    );
    mockPrisma.profile.findMany.mockResolvedValue([
      baseCandidate({ id: "opposed", specTestResults: [vectorResult(0)] }),
      baseCandidate({ id: "aligned", specShownPublicly: true, specTestResults: [vectorResult(70)] }),
    ]);

    const results = await getPersonalizedRecommendations("user-1");
    const aligned = results!.find((result) => result.profile.id === "aligned")!;
    const opposed = results!.find((result) => result.profile.id === "opposed")!;

    expect(aligned.compatibilityScore - opposed.compatibilityScore).toBe(15);
    expect(aligned.reasons).toContain("Your Spec preferences align both ways");
    expect(aligned.profile.specTestResults).toEqual([
      { specType: "grounded_equal", assumedAttractionTarget: undefined },
    ]);
    expect(aligned.profile).not.toHaveProperty("locationLat");
    expect(aligned.profile).not.toHaveProperty("matchPriority");
    expect(aligned.profile.specTestResults[0]).not.toHaveProperty("motiveScores");
    expect(opposed.profile.specTestResults).toEqual([]);
  });
});
