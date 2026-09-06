jest.mock("@/lib/prisma", () => ({
  prisma: {
    searchDocument: { upsert: jest.fn(), deleteMany: jest.fn() },
    searchInteraction: { create: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

import { upsertSearchDocument, deleteSearchDocument, searchDocuments, logSearchInteraction } from "@/lib/search";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  searchDocument: { upsert: jest.Mock; deleteMany: jest.Mock };
  searchInteraction: { create: jest.Mock };
  $queryRaw: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("upsertSearchDocument", () => {
  it("upserts by entityType+entityId with a default popularity of 0", async () => {
    await upsertSearchDocument({
      entityType: "profile",
      entityId: "profile-1",
      title: "Alice",
      body: "alice bio",
    });

    expect(mockPrisma.searchDocument.upsert).toHaveBeenCalledWith({
      where: { entityType_entityId: { entityType: "profile", entityId: "profile-1" } },
      create: { entityType: "profile", entityId: "profile-1", title: "Alice", body: "alice bio", popularity: 0 },
      update: { title: "Alice", body: "alice bio", popularity: 0 },
    });
  });

  it("passes through an explicit popularity", async () => {
    await upsertSearchDocument({
      entityType: "post",
      entityId: "post-1",
      title: "Hello",
      body: "Hello world",
      popularity: 5,
    });

    expect(mockPrisma.searchDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ popularity: 5 }),
        update: expect.objectContaining({ popularity: 5 }),
      }),
    );
  });
});

describe("deleteSearchDocument", () => {
  it("deletes by entityType+entityId", async () => {
    await deleteSearchDocument("post", "post-1");

    expect(mockPrisma.searchDocument.deleteMany).toHaveBeenCalledWith({
      where: { entityType: "post", entityId: "post-1" },
    });
  });
});

describe("searchDocuments", () => {
  it("returns an empty array without querying for a blank query", async () => {
    await expect(searchDocuments("   ")).resolves.toEqual([]);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("queries the database for a non-empty query", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { entityType: "profile", entityId: "profile-1", title: "Alice", rank: 0.9 },
    ]);

    const rows = await searchDocuments("alice");

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([{ entityType: "profile", entityId: "profile-1", title: "Alice", rank: 0.9 }]);
  });
});

describe("logSearchInteraction", () => {
  it("logs the query and result count", async () => {
    await logSearchInteraction("viewer-1", "alice", 3);

    expect(mockPrisma.searchInteraction.create).toHaveBeenCalledWith({
      data: { viewerId: "viewer-1", query: "alice", resultCount: 3 },
    });
  });

  it("never throws when logging fails", async () => {
    mockPrisma.searchInteraction.create.mockRejectedValue(new Error("db down"));

    await expect(logSearchInteraction(null, "alice", 0)).resolves.toBeUndefined();
  });
});
