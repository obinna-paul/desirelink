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
    await searchDiscoverProfiles(filters, { id: "viewer-1", locationLat: 0, locationLng: 0 });

    const where = mockPrisma.profile.findMany.mock.calls[0][0].where;
    expect(where.isSuspended).toBe(false);
    expect(where.blocksReceived).toEqual({ none: { blockerId: "viewer-1" } });
    expect(where.blocksMade).toEqual({ none: { blockedId: "viewer-1" } });
  });

  it("still excludes suspended profiles for an anonymous viewer, but has no viewer to block-filter against", async () => {
    const filters = parseDiscoverFilters({});
    await searchDiscoverProfiles(filters, null);

    const where = mockPrisma.profile.findMany.mock.calls[0][0].where;
    expect(where.isSuspended).toBe(false);
    expect(where.blocksReceived).toBeUndefined();
    expect(where.blocksMade).toBeUndefined();
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
