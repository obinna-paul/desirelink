jest.mock("@/lib/prisma", () => ({
  prisma: {
    creatorAffinity: { findMany: jest.fn() },
    profileTopic: { findMany: jest.fn() },
  },
}));

import { localityTerm, noveltyTerm, rankRecommendedProfiles, sharedTopicsTerm, trustTerm } from "@/lib/ranking/people-scoring";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  creatorAffinity: { findMany: jest.Mock };
  profileTopic: { findMany: jest.Mock };
};

const NOW = new Date("2026-09-06T12:00:00.000Z");
const LAGOS = { locationLat: 6.5, locationLng: 3.3 };
const NYC = { locationLat: 40.7, locationLng: -74.0 };
const NO_LOCATION = { locationLat: 0, locationLng: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.creatorAffinity.findMany.mockResolvedValue([]);
  mockPrisma.profileTopic.findMany.mockResolvedValue([]);
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

describe("sharedTopicsTerm", () => {
  it("is 0 when the viewer has selected no interests", () => {
    expect(sharedTopicsTerm(new Set(), new Set(["a"]))).toBe(0);
  });

  it("is the fraction of the viewer's own interests the candidate shares", () => {
    expect(sharedTopicsTerm(new Set(["a", "b"]), new Set(["a"]))).toBe(0.5);
    expect(sharedTopicsTerm(new Set(["a", "b"]), new Set(["a", "b", "c"]))).toBe(1);
    expect(sharedTopicsTerm(new Set(["a", "b"]), new Set(["c"]))).toBe(0);
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
    expect(mockPrisma.profileTopic.findMany).not.toHaveBeenCalled();
  });

  it("degrades gracefully for an anonymous viewer - trust and novelty still rank candidates", async () => {
    const candidates = [
      { id: "trusted", ...NO_LOCATION, createdAt: NOW, ...trustless, isTrustedMember: true },
      { id: "untrusted", ...NO_LOCATION, createdAt: NOW, ...trustless },
    ];

    const result = await rankRecommendedProfiles(null, candidates, NOW);

    expect(result).toEqual(["trusted", "untrusted"]);
    expect(mockPrisma.creatorAffinity.findMany).not.toHaveBeenCalled();
  });

  it("ranks by affinity, shared topics, locality, trust, and novelty combined", async () => {
    mockPrisma.creatorAffinity.findMany.mockResolvedValue([{ creatorId: "high-affinity", affinity: 60 }]);
    mockPrisma.profileTopic.findMany.mockResolvedValue([
      { profileId: "viewer-1", topicId: "t1" },
      { profileId: "viewer-1", topicId: "t2" },
      { profileId: "shared-topics", topicId: "t1" },
      { profileId: "shared-topics", topicId: "t2" },
    ]);

    const candidates = [
      { id: "high-affinity", ...NO_LOCATION, createdAt: NOW, ...trustless }, // 0.35*0.75 = .2625
      { id: "shared-topics", ...NO_LOCATION, createdAt: NOW, ...trustless }, // 0.25*1 = .25
      { id: "nothing-special", ...NO_LOCATION, createdAt: NOW, ...trustless }, // 0
    ];

    const result = await rankRecommendedProfiles({ id: "viewer-1", ...NO_LOCATION }, candidates, NOW);

    // high-affinity: 0.35*0.75 = .2625 > shared-topics: 0.25*1 = .25 (both plus an equal,
    // tied novelty contribution from the identical createdAt, so it doesn't affect order).
    expect(result).toEqual(["high-affinity", "shared-topics", "nothing-special"]);
    expect(mockPrisma.creatorAffinity.findMany).toHaveBeenCalledWith({
      where: { viewerId: "viewer-1", creatorId: { in: ["high-affinity", "shared-topics", "nothing-special"] } },
      select: { creatorId: true, affinity: true },
    });
  });
});
