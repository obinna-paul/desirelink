jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findMany: jest.fn() },
    creatorAffinity: { findMany: jest.fn() },
    profileTopic: { findMany: jest.fn() },
  },
}));

import { parseCreatorDirectoryFilters, searchSubscribableCreators } from "@/lib/creators-directory";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  profile: { findMany: jest.Mock };
  creatorAffinity: { findMany: jest.Mock };
  profileTopic: { findMany: jest.Mock };
};

function creatorRow(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    username: id,
    displayName: id,
    avatarUrl: "",
    isVerified: false,
    isVerifiedCreator: false,
    isVerifiedServiceProvider: false,
    isTrustedMember: false,
    createdAt: new Date("2026-09-06T12:00:00.000Z"),
    creatorTiers: [{ priceCents: 500 }],
    _count: { subscriptionsAsCreator: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.profile.findMany.mockResolvedValue([]);
  mockPrisma.creatorAffinity.findMany.mockResolvedValue([]);
  mockPrisma.profileTopic.findMany.mockResolvedValue([]);
});

describe("searchSubscribableCreators", () => {
  it("defaults to recommended when no sort is specified", () => {
    const filters = parseCreatorDirectoryFilters({});
    expect(filters.sort).toBe("recommended");
  });

  it("orders the candidate query deterministically before truncating to the candidate limit", async () => {
    const filters = parseCreatorDirectoryFilters({});
    await searchSubscribableCreators(filters, "viewer-1");

    expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 300 }),
    );
  });

  it("re-orders candidates by the recommended score rather than query order", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([creatorRow("unremarkable"), creatorRow("trusted", { isTrustedMember: true })]);

    const filters = parseCreatorDirectoryFilters({});
    const creators = await searchSubscribableCreators(filters, "viewer-1");

    expect(creators.map((c) => c.id)).toEqual(["trusted", "unremarkable"]);
  });

  it("works for an anonymous viewer without throwing", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([creatorRow("a"), creatorRow("b", { isTrustedMember: true })]);

    const filters = parseCreatorDirectoryFilters({});
    const creators = await searchSubscribableCreators(filters, null);

    expect(creators.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("still supports the manual sorts unchanged", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      creatorRow("expensive", { creatorTiers: [{ priceCents: 5000 }] }),
      creatorRow("cheap", { creatorTiers: [{ priceCents: 500 }] }),
    ]);

    const filters = parseCreatorDirectoryFilters({ sort: "price_low" });
    const creators = await searchSubscribableCreators(filters, "viewer-1");

    expect(creators.map((c) => c.id)).toEqual(["cheap", "expensive"]);
    expect(mockPrisma.creatorAffinity.findMany).not.toHaveBeenCalled();
  });
});
