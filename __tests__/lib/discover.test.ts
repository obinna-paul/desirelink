jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findMany: jest.fn() },
  },
}));

import { parseDiscoverFilters, searchDiscoverProfiles } from "@/lib/discover";
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
