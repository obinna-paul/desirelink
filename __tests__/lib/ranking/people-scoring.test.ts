jest.mock("@/lib/prisma", () => ({
  prisma: {
    creatorAffinity: { findMany: jest.fn() },
  },
}));

import {
  localityTerm,
  noveltyTerm,
  rankRecommendedCreators,
  rankRecommendedProfiles,
  trustTerm,
  typeTerm,
} from "@/lib/ranking/people-scoring";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  creatorAffinity: { findMany: jest.Mock };
};

const NOW = new Date("2026-09-06T12:00:00.000Z");
const LAGOS = { locationLat: 6.5, locationLng: 3.3 };
const NYC = { locationLat: 40.7, locationLng: -74.0 };
const NO_LOCATION = { locationLat: 0, locationLng: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.creatorAffinity.findMany.mockResolvedValue([]);
});

describe("localityTerm", () => {
  it("is 0 with no viewer", () => {
    expect(localityTerm(null, LAGOS)).toBe(0);
  });

  it("is 0 when either side has no location on file", () => {
    expect(localityTerm(LAGOS, NO_LOCATION)).toBe(0);
    expect(localityTerm(NO_LOCATION, LAGOS)).toBe(0);
  });

  it("is 1 for the same coordinates and 0 for a continent away", () => {
    expect(localityTerm(LAGOS, LAGOS)).toBe(1);
    expect(localityTerm(LAGOS, NYC)).toBe(0);
  });
});

describe("typeTerm", () => {
  it("is 0 for an anonymous/typeless viewer regardless of candidate type", () => {
    expect(typeTerm(null, "SEEKER")).toBe(0);
    expect(typeTerm(null, "CREATOR")).toBe(0);
  });

  it("ranks a seeker's own type first, then explorers, then creators", () => {
    expect(typeTerm("SEEKER", "SEEKER")).toBe(1);
    expect(typeTerm("SEEKER", "EXPLORER")).toBe(0.5);
    expect(typeTerm("SEEKER", "CREATOR")).toBe(0);
  });

  it("ranks an explorer's creators first, then explorers, then seekers", () => {
    expect(typeTerm("EXPLORER", "CREATOR")).toBe(1);
    expect(typeTerm("EXPLORER", "EXPLORER")).toBe(0.5);
    expect(typeTerm("EXPLORER", "SEEKER")).toBe(0);
  });

  it("ranks a creator's explorers first, then creators, then seekers", () => {
    expect(typeTerm("CREATOR", "EXPLORER")).toBe(1);
    expect(typeTerm("CREATOR", "CREATOR")).toBe(0.5);
    expect(typeTerm("CREATOR", "SEEKER")).toBe(0);
  });
});

describe("trustTerm", () => {
  const base = { isTrustedMember: false, isVerified: false, isVerifiedCreator: false, isVerifiedServiceProvider: false };

  it("is 1 for a trusted member", () => {
    expect(trustTerm({ ...base, isTrustedMember: true })).toBe(1);
  });

  it("is 0.5 for any verified flag without trusted-member status", () => {
    expect(trustTerm({ ...base, isVerified: true })).toBe(0.5);
    expect(trustTerm({ ...base, isVerifiedCreator: true })).toBe(0.5);
    expect(trustTerm({ ...base, isVerifiedServiceProvider: true })).toBe(0.5);
  });

  it("is 0 with no trust signal at all", () => {
    expect(trustTerm(base)).toBe(0);
  });
});

describe("noveltyTerm", () => {
  it("decays on a 30-day half-life", () => {
    expect(noveltyTerm(NOW, NOW)).toBe(1);
    expect(noveltyTerm(new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000), NOW)).toBeCloseTo(0.5, 10);
    expect(noveltyTerm(new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000), NOW)).toBeCloseTo(0.25, 10);
  });
});

const trustless = { isTrustedMember: false, isVerified: false, isVerifiedCreator: false, isVerifiedServiceProvider: false };

describe("rankRecommendedProfiles", () => {
  it("returns an empty list without querying prisma for an empty candidate set", async () => {
    const result = await rankRecommendedProfiles(null, [], NOW);
    expect(result).toEqual([]);
    expect(mockPrisma.creatorAffinity.findMany).not.toHaveBeenCalled();
  });

  it("degrades gracefully for an anonymous viewer - trust and novelty still rank candidates", async () => {
    const candidates = [
      { id: "trusted", profileType: "EXPLORER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless, isTrustedMember: true },
      { id: "untrusted", profileType: "EXPLORER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless },
    ];

    const result = await rankRecommendedProfiles(null, candidates, NOW);

    expect(result).toEqual(["trusted", "untrusted"]);
    expect(mockPrisma.creatorAffinity.findMany).not.toHaveBeenCalled();
  });

  it("ranks by affinity, type, locality, trust, and novelty combined", async () => {
    mockPrisma.creatorAffinity.findMany.mockResolvedValue([{ creatorId: "high-affinity", affinity: 60 }]);

    // Every candidate shares the viewer's own EXPLORER type, so the type term (0.2*0.5=.1)
    // is a constant added to each score below and doesn't affect the ordering - it's
    // exercised on its own in the "typeTerm" and "type tiering" tests instead.
    const candidates = [
      { id: "high-affinity", profileType: "EXPLORER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless }, // .4*.75 + .1 = .4
      { id: "trusted", profileType: "EXPLORER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless, isTrustedMember: true }, // .15*1 + .1 = .25
      { id: "nothing-special", profileType: "EXPLORER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless }, // 0 + .1 = .1
    ];

    const result = await rankRecommendedProfiles(
      { id: "viewer-1", profileType: "EXPLORER", ...NO_LOCATION, specTestResults: [] },
      candidates,
      NOW,
    );

    expect(result).toEqual(["high-affinity", "trusted", "nothing-special"]);
    expect(mockPrisma.creatorAffinity.findMany).toHaveBeenCalledWith({
      where: { viewerId: "viewer-1", creatorId: { in: ["high-affinity", "trusted", "nothing-special"] } },
      select: { creatorId: true, affinity: true },
    });
  });

  it("ranks a seeker viewer's fellow seekers above explorers and creators with otherwise-identical signals", async () => {
    const candidates = [
      { id: "a-creator", profileType: "CREATOR" as const, ...NO_LOCATION, createdAt: NOW, ...trustless },
      { id: "a-seeker", profileType: "SEEKER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless },
      { id: "an-explorer", profileType: "EXPLORER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless },
    ];

    const result = await rankRecommendedProfiles(
      { id: "viewer-1", profileType: "SEEKER", ...NO_LOCATION, specTestResults: [] },
      candidates,
      NOW,
    );

    expect(result).toEqual(["a-seeker", "an-explorer", "a-creator"]);
  });

  it("shuffles same-tier candidates deterministically for a given viewer and time bucket", async () => {
    // Identical on every scored term - only the seeded tiebreak can separate them - so any
    // fixed order returned here must be reproduced on a second call for the same bucket.
    const candidates = [
      { id: "tied-1", profileType: "EXPLORER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless },
      { id: "tied-2", profileType: "EXPLORER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless },
      { id: "tied-3", profileType: "EXPLORER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless },
    ];
    const viewer = { id: "viewer-1", profileType: "EXPLORER" as const, ...NO_LOCATION, specTestResults: [] };

    const first = await rankRecommendedProfiles(viewer, candidates, NOW);
    const second = await rankRecommendedProfiles(viewer, candidates, NOW);

    expect(first).toEqual(second);
    expect(new Set(first)).toEqual(new Set(["tied-1", "tied-2", "tied-3"]));
  });

  it("ranks a spec-compatible candidate above an otherwise-identical one with no spec signal", async () => {
    const viewer = {
      id: "viewer-1",
      profileType: "EXPLORER" as const,
      ...NO_LOCATION,
      specTestResults: [{ specType: "soft_landing" }],
    };
    const candidates = [
      { id: "no-spec", profileType: "EXPLORER" as const, ...NO_LOCATION, createdAt: NOW, ...trustless },
      {
        id: "complement",
        profileType: "EXPLORER" as const,
        ...NO_LOCATION,
        createdAt: NOW,
        ...trustless,
        specTestResults: [{ specType: "grounded_equal" }],
      },
    ];

    const result = await rankRecommendedProfiles(viewer, candidates, NOW);

    expect(result).toEqual(["complement", "no-spec"]);
  });
});

describe("rankRecommendedCreators", () => {
  it("returns an empty list without querying prisma for an empty candidate set", async () => {
    const result = await rankRecommendedCreators(null, [], NOW);
    expect(result).toEqual([]);
    expect(mockPrisma.creatorAffinity.findMany).not.toHaveBeenCalled();
  });

  it("degrades gracefully for an anonymous viewer - trust and novelty still rank candidates", async () => {
    const candidates = [
      { id: "trusted", createdAt: NOW, ...trustless, isTrustedMember: true },
      { id: "untrusted", createdAt: NOW, ...trustless },
    ];

    const result = await rankRecommendedCreators(null, candidates, NOW);

    expect(result).toEqual(["trusted", "untrusted"]);
    expect(mockPrisma.creatorAffinity.findMany).not.toHaveBeenCalled();
  });

  it("ranks by affinity and trust combined, with no locality term", async () => {
    mockPrisma.creatorAffinity.findMany.mockResolvedValue([{ creatorId: "high-affinity", affinity: 60 }]);

    const candidates = [
      { id: "high-affinity", createdAt: NOW, ...trustless }, // 0.55*0.75 = .4125
      { id: "trusted", createdAt: NOW, ...trustless, isTrustedMember: true }, // 0.25*1 = .25
      { id: "nothing-special", createdAt: NOW, ...trustless }, // 0
    ];

    const result = await rankRecommendedCreators("viewer-1", candidates, NOW);

    expect(result).toEqual(["high-affinity", "trusted", "nothing-special"]);
  });
});
