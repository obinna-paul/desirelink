jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findMany: jest.fn() },
    creatorAffinity: { findMany: jest.fn() },
    profileTopic: { findMany: jest.fn() },
  },
}));

import { parseDiscoverFilters, searchDiscoverProfiles } from "@/lib/discover";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  profile: { findMany: jest.Mock };
  creatorAffinity: { findMany: jest.Mock };
  profileTopic: { findMany: jest.Mock };
};

function candidate(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    username: id,
    displayName: id,
    avatarUrl: "",
    bannerUrl: "",
    city: null,
    country: null,
    showExactLocation: false,
    profileType: "CREATOR",
    serviceCategories: [],
    isVerified: false,
    isVerifiedCreator: false,
    isVerifiedServiceProvider: false,
    verificationPending: false,
    isTrustedMember: false,
    availabilityStatuses: [],
    locationLat: 0,
    locationLng: 0,
    createdAt: new Date("2026-09-06T12:00:00.000Z"),
    lastActiveAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.profile.findMany.mockResolvedValue([]);
  mockPrisma.creatorAffinity.findMany.mockResolvedValue([]);
  mockPrisma.profileTopic.findMany.mockResolvedValue([]);
});

describe("searchDiscoverProfiles - recommended sort", () => {
  it("defaults to recommended when no sort is specified", () => {
    const filters = parseDiscoverFilters({});
    expect(filters.sort).toBe("recommended");
  });

  it("orders the candidate query deterministically before truncating to the candidate limit", async () => {
    const filters = parseDiscoverFilters({});
    await searchDiscoverProfiles(filters, { id: "viewer-1", profileType: "EXPLORER" as const, locationLat: 0, locationLng: 0, specTestResults: [] });

    expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 1000 }),
    );
  });

  it("re-orders candidates by the recommended score rather than query order", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      candidate("unremarkable"),
      candidate("trusted", { isTrustedMember: true }),
    ]);

    const filters = parseDiscoverFilters({});
    const { profiles } = await searchDiscoverProfiles(filters, { id: "viewer-1", profileType: "EXPLORER" as const, locationLat: 0, locationLng: 0, specTestResults: [] });

    expect(profiles.map((p) => p.id)).toEqual(["trusted", "unremarkable"]);
  });

  it("works for an anonymous viewer without throwing, degrading to trust/novelty only", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([candidate("a"), candidate("b", { isTrustedMember: true })]);

    const filters = parseDiscoverFilters({});
    const { profiles } = await searchDiscoverProfiles(filters, null);

    expect(profiles.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("still respects an explicit radius filter under recommended sort", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      candidate("far", { locationLat: 40.7, locationLng: -74.0 }),
      candidate("near", { locationLat: 6.5, locationLng: 3.3 }),
    ]);

    const filters = parseDiscoverFilters({ radius: "10" });
    const { profiles } = await searchDiscoverProfiles(filters, { id: "viewer-1", profileType: "EXPLORER" as const, locationLat: 6.5, locationLng: 3.3, specTestResults: [] });

    expect(profiles.map((p) => p.id)).toEqual(["near"]);
  });

  it("does not exclude a distant profile when no radius filter was ever set, even for a viewer with a real location", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      candidate("far", { locationLat: 40.7, locationLng: -74.0 }),
      candidate("near", { locationLat: 6.5, locationLng: 3.3 }),
    ]);

    const filters = parseDiscoverFilters({});
    const { profiles } = await searchDiscoverProfiles(filters, { id: "viewer-1", profileType: "EXPLORER" as const, locationLat: 6.5, locationLng: 3.3, specTestResults: [] });

    expect(profiles.map((p) => p.id).sort()).toEqual(["far", "near"]);
  });

  it("pages through the ranked candidate pool via offset instead of always returning the first page", async () => {
    const candidates = Array.from({ length: 35 }, (_, i) => candidate(`p${i}`));
    mockPrisma.profile.findMany.mockResolvedValue(candidates);

    const filters = parseDiscoverFilters({});
    const viewer = { id: "viewer-1", profileType: "EXPLORER" as const, locationLat: 0, locationLng: 0, specTestResults: [] };

    const firstPage = await searchDiscoverProfiles(filters, viewer, 0);
    const secondPage = await searchDiscoverProfiles(filters, viewer, 30);

    expect(firstPage.profiles).toHaveLength(30);
    expect(firstPage.hasMore).toBe(true);
    expect(secondPage.profiles).toHaveLength(5);
    expect(secondPage.hasMore).toBe(false);
    // No overlap between pages - offset actually advances through the same ranked order.
    const firstIds = new Set(firstPage.profiles.map((p) => p.id));
    expect(secondPage.profiles.every((p) => !firstIds.has(p.id))).toBe(true);
  });
});
