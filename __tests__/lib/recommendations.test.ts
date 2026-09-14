jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findUnique: jest.fn(), findMany: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getPersonalizedRecommendations } from "@/lib/recommendations";

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

describe("getPersonalizedRecommendations - spec compatibility term", () => {
  beforeEach(() => jest.clearAllMocks());

  it("boosts and explains a candidate whose spec complements the viewer's", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(
      baseProfile({ specTestResults: [{ specType: "soft_landing" }] }),
    );
    mockPrisma.profile.findMany.mockResolvedValue([
      baseCandidate({ id: "no-spec" }),
      baseCandidate({ id: "complement", specTestResults: [{ specType: "grounded_equal" }] }),
    ]);

    const results = await getPersonalizedRecommendations("user-1");

    expect(results).not.toBeNull();
    const complement = results!.find((r) => r.profile.id === "complement")!;
    const noSpec = results!.find((r) => r.profile.id === "no-spec")!;

    expect(complement.reasons).toContain("Great spec match");
    expect(complement.compatibilityScore).toBeGreaterThan(noSpec.compatibilityScore);
    // Highest-listed complement for soft_landing is grounded_equal - full weight, so the
    // full +15 should be reflected (both candidates are otherwise identical).
    expect(complement.compatibilityScore - noSpec.compatibilityScore).toBe(15);
  });

  it("credits, but less than a true complement, when the candidate shares the viewer's own spec", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(
      baseProfile({ specTestResults: [{ specType: "soft_landing" }] }),
    );
    mockPrisma.profile.findMany.mockResolvedValue([
      baseCandidate({ id: "same-spec", specTestResults: [{ specType: "soft_landing" }] }),
      baseCandidate({ id: "complement", specTestResults: [{ specType: "grounded_equal" }] }),
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

    expect(results![0].reasons).not.toContain("Great spec match");
    expect(results![0].reasons).not.toContain("Shares your spec");
  });
});
