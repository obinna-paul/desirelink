jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findMany: jest.fn() },
  },
}));

import { parseDiscoverFilters, searchDiscoverProfiles, suggestDiscoverProfiles } from "@/lib/discover";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  profile: { findMany: jest.Mock };
};

describe("searchDiscoverProfiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profile.findMany.mockResolvedValue([]);
  });

  it("excludes suspended profiles and profiles blocked either way, symmetric with lib/recommendations.ts", async () => {
    const filters = parseDiscoverFilters({});
    await searchDiscoverProfiles(filters, { id: "viewer-1", profileType: "EXPLORER", locationLat: 0, locationLng: 0, specTestResults: [] });

    const where = mockPrisma.profile.findMany.mock.calls[0][0].where;
    expect(where.isSuspended).toBe(false);
    expect(where.blocksReceived).toEqual({ none: { blockerId: "viewer-1" } });
    expect(where.blocksMade).toEqual({ none: { blockedId: "viewer-1" } });
  });

  it("filters to profiles with a publicly-shown spec matching one of the requested archetypes", async () => {
    const filters = parseDiscoverFilters({ spec: ["soft_landing", "grounded_equal"] });
    await searchDiscoverProfiles(filters, null);

    const where = mockPrisma.profile.findMany.mock.calls[0][0].where;
    expect(where.specShownPublicly).toBe(true);
    expect(where.specTestResults).toEqual({ some: { specType: { in: ["soft_landing", "grounded_equal"] } } });
  });

  it("drops an unrecognized spec value and applies no spec filter when none survive", async () => {
    const filters = parseDiscoverFilters({ spec: ["not-a-real-archetype"] });
    expect(filters.specTypes).toEqual([]);

    await searchDiscoverProfiles(filters, null);
    const where = mockPrisma.profile.findMany.mock.calls[0][0].where;
    expect(where.specShownPublicly).toBeUndefined();
    expect(where.specTestResults).toBeUndefined();
  });

  it("still excludes suspended profiles for an anonymous viewer, but has no viewer to block-filter against", async () => {
    const filters = parseDiscoverFilters({});
    await searchDiscoverProfiles(filters, null);

    const where = mockPrisma.profile.findMany.mock.calls[0][0].where;
    expect(where.isSuspended).toBe(false);
    expect(where.blocksReceived).toBeUndefined();
    expect(where.blocksMade).toBeUndefined();
  });

  it("pages the plain (unranked) sort at the DB level via skip/take, not a bounded in-memory pool", async () => {
    // sort=newest skips in-memory ranking entirely - hasMore here must come from an
    // over-fetch (page size + 1), not from re-slicing an already-limited candidate array.
    mockPrisma.profile.findMany.mockResolvedValue(
      Array.from({ length: 31 }, (_, i) => ({ id: `p${i}` })),
    );

    const filters = parseDiscoverFilters({ sort: "newest" });
    const result = await searchDiscoverProfiles(filters, null, 0);

    expect(mockPrisma.profile.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 31 });
    expect(result.profiles).toHaveLength(30);
    expect(result.hasMore).toBe(true);
  });

  it("reports no more pages once the over-fetch comes back within a page size", async () => {
    mockPrisma.profile.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` })),
    );

    const filters = parseDiscoverFilters({ sort: "newest" });
    const result = await searchDiscoverProfiles(filters, null, 30);

    expect(mockPrisma.profile.findMany.mock.calls[0][0]).toMatchObject({ skip: 30, take: 31 });
    expect(result.profiles).toHaveLength(5);
    expect(result.hasMore).toBe(false);
  });

  it("keeps exact coordinates and private Spec vectors inside the server-side ranking layer", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([{
      id: "candidate-1",
      username: "candidate",
      displayName: "Candidate",
      profileType: "EXPLORER",
      locationLat: 6.5,
      locationLng: 3.3,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      lastActiveAt: new Date("2026-09-01T00:00:00.000Z"),
      isTrustedMember: false,
      isVerified: false,
      isVerifiedCreator: false,
      isVerifiedServiceProvider: false,
      availabilityStatuses: [],
      specShownPublicly: false,
      specTestResults: [{
        specType: "grounded_equal",
        assumedAttractionTarget: "female",
        motiveScores: { motives: { warmthResponsiveness: 75 } },
        lenses: { sparkSafety: 75 },
        attachment: { anxiety: 25, avoidance: 25 },
      }],
    }]);

    const result = await searchDiscoverProfiles(parseDiscoverFilters({}), null);

    expect(result.profiles[0]).not.toHaveProperty("locationLat");
    expect(result.profiles[0]).not.toHaveProperty("locationLng");
    expect(result.profiles[0].specTestResults).toEqual([]);
  });
});

describe("suggestDiscoverProfiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profile.findMany.mockResolvedValue([]);
  });

  it("returns nothing for an empty or whitespace-only query without hitting the database", async () => {
    expect(await suggestDiscoverProfiles("", "viewer-1")).toEqual([]);
    expect(await suggestDiscoverProfiles("   ", "viewer-1")).toEqual([]);
    expect(mockPrisma.profile.findMany).not.toHaveBeenCalled();
  });

  it("matches on username or display name, case-insensitively", async () => {
    await suggestDiscoverProfiles("ada", "viewer-1");

    const where = mockPrisma.profile.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { username: { contains: "ada", mode: "insensitive" } },
      { displayName: { contains: "ada", mode: "insensitive" } },
    ]);
  });

  it("excludes suspended profiles and profiles blocked either way", async () => {
    await suggestDiscoverProfiles("ada", "viewer-1");

    const where = mockPrisma.profile.findMany.mock.calls[0][0].where;
    expect(where.isSuspended).toBe(false);
    expect(where.NOT).toEqual({ id: "viewer-1" });
    expect(where.blocksReceived).toEqual({ none: { blockerId: "viewer-1" } });
    expect(where.blocksMade).toEqual({ none: { blockedId: "viewer-1" } });
  });

  it("has no viewer to exclude or block-filter against for an anonymous viewer", async () => {
    await suggestDiscoverProfiles("ada", null);

    const where = mockPrisma.profile.findMany.mock.calls[0][0].where;
    expect(where.NOT).toBeUndefined();
    expect(where.blocksReceived).toBeUndefined();
    expect(where.blocksMade).toBeUndefined();
  });

  it("ranks a username prefix match above a display-name prefix match above a mere substring match", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      { username: "someadafan", displayName: "Fan Account", avatarUrl: "" },
      { username: "ada_writes", displayName: "Someone Else", avatarUrl: "" },
      { username: "writer99", displayName: "Ada Lovelace", avatarUrl: "" },
    ]);

    const result = await suggestDiscoverProfiles("ada", "viewer-1");

    expect(result.map((r) => r.username)).toEqual(["ada_writes", "writer99", "someadafan"]);
  });

  it("caps results at 6, keeping the highest-ranked matches", async () => {
    mockPrisma.profile.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        username: `ada${i}`,
        displayName: `Ada ${i}`,
        avatarUrl: "",
      })),
    );

    const result = await suggestDiscoverProfiles("ada", "viewer-1");

    expect(result).toHaveLength(6);
  });
});
