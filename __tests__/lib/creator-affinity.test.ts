jest.mock("@/lib/prisma", () => ({
  prisma: {
    postImpression: { findMany: jest.fn() },
    postReaction: { findMany: jest.fn() },
    postComment: { findMany: jest.fn() },
    postShare: { findMany: jest.fn() },
    savedPost: { findMany: jest.fn() },
    postUnlock: { findMany: jest.fn() },
    postFeedback: { findMany: jest.fn() },
    creatorAffinity: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import { refreshCreatorAffinity } from "@/lib/creator-affinity";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  postImpression: { findMany: jest.Mock };
  postReaction: { findMany: jest.Mock };
  postComment: { findMany: jest.Mock };
  postShare: { findMany: jest.Mock };
  savedPost: { findMany: jest.Mock };
  postUnlock: { findMany: jest.Mock };
  postFeedback: { findMany: jest.Mock };
  creatorAffinity: { deleteMany: jest.Mock; createMany: jest.Mock };
};

const NOW = new Date("2026-09-06T12:00:00.000Z");

function authored(authorId: string) {
  return { post: { authorId } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.postImpression.findMany.mockResolvedValue([]);
  mockPrisma.postReaction.findMany.mockResolvedValue([]);
  mockPrisma.postComment.findMany.mockResolvedValue([]);
  mockPrisma.postShare.findMany.mockResolvedValue([]);
  mockPrisma.savedPost.findMany.mockResolvedValue([]);
  mockPrisma.postUnlock.findMany.mockResolvedValue([]);
  mockPrisma.postFeedback.findMany.mockResolvedValue([]);
});

function rowsFromCreateMany(): { viewerId: string; creatorId: string; affinity: number }[] {
  return mockPrisma.creatorAffinity.createMany.mock.calls[0][0].data;
}

describe("refreshCreatorAffinity", () => {
  it("does nothing when there's no activity", async () => {
    const summary = await refreshCreatorAffinity(NOW);

    expect(summary).toEqual({ pairsUpdated: 0 });
    expect(mockPrisma.creatorAffinity.deleteMany).toHaveBeenCalledWith({});
    expect(mockPrisma.creatorAffinity.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it("decays event weight by age using a 14-day half-life", async () => {
    // exactly one half-life old -> weight 1 (like) * 0.5
    mockPrisma.postReaction.findMany.mockResolvedValue([
      { userId: "viewer-1", createdAt: new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000), ...authored("creator-1") },
    ]);

    const summary = await refreshCreatorAffinity(NOW);

    expect(summary).toEqual({ pairsUpdated: 1 });
    const rows = rowsFromCreateMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].viewerId).toBe("viewer-1");
    expect(rows[0].creatorId).toBe("creator-1");
    expect(rows[0].affinity).toBeCloseTo(0.5, 10);
  });

  it("sums weighted, decayed signals across sources for the same pair", async () => {
    // all events at NOW - decayWeight(0) = 1, so raw weights apply undecayed
    mockPrisma.postImpression.findMany.mockResolvedValue([{ viewerId: "viewer-1", createdAt: NOW, ...authored("creator-1") }]);
    mockPrisma.postReaction.findMany.mockResolvedValue([{ userId: "viewer-1", createdAt: NOW, ...authored("creator-1") }]);
    mockPrisma.postComment.findMany.mockResolvedValue([{ authorId: "viewer-1", createdAt: NOW, ...authored("creator-1") }]);
    mockPrisma.postShare.findMany.mockResolvedValue([{ userId: "viewer-1", createdAt: NOW, ...authored("creator-1") }]);
    mockPrisma.savedPost.findMany.mockResolvedValue([{ viewerId: "viewer-1", createdAt: NOW, ...authored("creator-1") }]);
    mockPrisma.postUnlock.findMany.mockResolvedValue([{ subscriberId: "viewer-1", createdAt: NOW, ...authored("creator-1") }]);

    const summary = await refreshCreatorAffinity(NOW);

    // 0.5 (impression) + 1 (like) + 2 (comment) + 3 (share) + 3 (save) + 6 (unlock) = 15.5
    expect(summary).toEqual({ pairsUpdated: 1 });
    expect(rowsFromCreateMany()).toEqual([{ viewerId: "viewer-1", creatorId: "creator-1", affinity: 15.5 }]);
  });

  it("never records self-affinity from a creator's own posts", async () => {
    mockPrisma.postReaction.findMany.mockResolvedValue([{ userId: "creator-1", createdAt: NOW, ...authored("creator-1") }]);

    const summary = await refreshCreatorAffinity(NOW);

    expect(summary).toEqual({ pairsUpdated: 0 });
  });

  it("uses explicit feedback as a positive or negative creator signal", async () => {
    mockPrisma.postFeedback.findMany.mockResolvedValue([
      { viewerId: "viewer-1", kind: "interested", createdAt: NOW, ...authored("creator-1") },
      { viewerId: "viewer-2", kind: "not_interested", createdAt: NOW, ...authored("creator-1") },
    ]);

    await refreshCreatorAffinity(NOW);

    expect(rowsFromCreateMany()).toEqual(
      expect.arrayContaining([
        { viewerId: "viewer-1", creatorId: "creator-1", affinity: 3 },
        { viewerId: "viewer-2", creatorId: "creator-1", affinity: -5 },
      ]),
    );
  });

  it("keeps separate creators for the same viewer as separate pairs", async () => {
    mockPrisma.postReaction.findMany.mockResolvedValue([
      { userId: "viewer-1", createdAt: NOW, ...authored("creator-1") },
      { userId: "viewer-1", createdAt: NOW, ...authored("creator-2") },
    ]);

    const summary = await refreshCreatorAffinity(NOW);

    expect(summary).toEqual({ pairsUpdated: 2 });
    const rows = rowsFromCreateMany();
    expect(rows).toEqual(
      expect.arrayContaining([
        { viewerId: "viewer-1", creatorId: "creator-1", affinity: 1 },
        { viewerId: "viewer-1", creatorId: "creator-2", affinity: 1 },
      ]),
    );
  });

  it("queries raw events bounded to the 45-day PostImpression retention window", async () => {
    await refreshCreatorAffinity(NOW);

    const expectedSince = new Date("2026-07-23T12:00:00.000Z");
    expect(mockPrisma.postImpression.findMany).toHaveBeenCalledWith({
      where: { createdAt: { gte: expectedSince } },
      select: { viewerId: true, createdAt: true, post: { select: { authorId: true } } },
    });
    expect(mockPrisma.postReaction.findMany).toHaveBeenCalledWith({
      where: { createdAt: { gte: expectedSince }, type: "like" },
      select: { userId: true, createdAt: true, post: { select: { authorId: true } } },
    });
  });
});
