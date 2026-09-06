jest.mock("@/lib/prisma", () => ({
  prisma: {
    postImpression: { groupBy: jest.fn(), deleteMany: jest.fn() },
    postReaction: { groupBy: jest.fn() },
    postComment: { groupBy: jest.fn() },
    postShare: { groupBy: jest.fn() },
    savedPost: { groupBy: jest.fn() },
    postUnlock: { groupBy: jest.fn() },
    postDailyStats: { upsert: jest.fn() },
  },
}));

import { rollupPostDailyStats, pruneOldPostImpressions } from "@/lib/post-daily-stats";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  postImpression: { groupBy: jest.Mock; deleteMany: jest.Mock };
  postReaction: { groupBy: jest.Mock };
  postComment: { groupBy: jest.Mock };
  postShare: { groupBy: jest.Mock };
  savedPost: { groupBy: jest.Mock };
  postUnlock: { groupBy: jest.Mock };
  postDailyStats: { upsert: jest.Mock };
};

function countRow(postId: string, count: number) {
  return { postId, _count: { _all: count } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.postImpression.groupBy.mockResolvedValue([]);
  mockPrisma.postReaction.groupBy.mockResolvedValue([]);
  mockPrisma.postComment.groupBy.mockResolvedValue([]);
  mockPrisma.postShare.groupBy.mockResolvedValue([]);
  mockPrisma.savedPost.groupBy.mockResolvedValue([]);
  mockPrisma.postUnlock.groupBy.mockResolvedValue([]);
});

describe("rollupPostDailyStats", () => {
  it("defaults to yesterday (UTC) and upserts nothing when there's no activity", async () => {
    const summary = await rollupPostDailyStats(new Date("2026-09-06T12:00:00.000Z"));

    expect(summary).toEqual({ date: "2026-09-05", postsUpdated: 0 });
    expect(mockPrisma.postDailyStats.upsert).not.toHaveBeenCalled();
  });

  it("combines counts across sources into one weighted row per post", async () => {
    mockPrisma.postImpression.groupBy.mockResolvedValue([countRow("post-1", 100)]);
    mockPrisma.postReaction.groupBy.mockResolvedValue([countRow("post-1", 10)]);
    mockPrisma.postComment.groupBy.mockResolvedValue([countRow("post-1", 3)]);
    mockPrisma.postShare.groupBy.mockResolvedValue([countRow("post-1", 2)]);
    mockPrisma.savedPost.groupBy.mockResolvedValue([countRow("post-1", 4)]);
    mockPrisma.postUnlock.groupBy.mockResolvedValue([countRow("post-1", 1)]);

    const summary = await rollupPostDailyStats(new Date("2026-09-06T12:00:00.000Z"));

    expect(summary).toEqual({ date: "2026-09-05", postsUpdated: 1 });
    const dayStart = new Date("2026-09-05T00:00:00.000Z");
    expect(mockPrisma.postDailyStats.upsert).toHaveBeenCalledWith({
      where: { postId_date: { postId: "post-1", date: dayStart } },
      create: {
        postId: "post-1",
        date: dayStart,
        impressions: 100,
        likes: 10,
        comments: 3,
        shares: 2,
        saves: 4,
        unlocks: 1,
        // 1*6 + 2*3 + 4*3 + 3*2 + 10*1 = 6 + 6 + 12 + 6 + 10 = 40
        weightedEngagement: 40,
      },
      update: {
        impressions: 100,
        likes: 10,
        comments: 3,
        shares: 2,
        saves: 4,
        unlocks: 1,
        weightedEngagement: 40,
      },
    });
  });

  it("still writes a row for a post with only impressions and zero engagement", async () => {
    mockPrisma.postImpression.groupBy.mockResolvedValue([countRow("post-2", 5)]);

    await rollupPostDailyStats(new Date("2026-09-06T12:00:00.000Z"));

    expect(mockPrisma.postDailyStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ impressions: 5, weightedEngagement: 0 }),
      }),
    );
  });

  it("scopes every source query to the same UTC day window", async () => {
    await rollupPostDailyStats(new Date("2026-09-06T12:00:00.000Z"));

    const expectedRange = {
      gte: new Date("2026-09-05T00:00:00.000Z"),
      lt: new Date("2026-09-06T00:00:00.000Z"),
    };
    expect(mockPrisma.postImpression.groupBy).toHaveBeenCalledWith({
      by: ["postId"],
      where: { createdAt: expectedRange },
      _count: { _all: true },
    });
    expect(mockPrisma.postReaction.groupBy).toHaveBeenCalledWith({
      by: ["postId"],
      where: { createdAt: expectedRange, type: "like" },
      _count: { _all: true },
    });
  });
});

describe("pruneOldPostImpressions", () => {
  it("deletes impressions older than the retention window", async () => {
    mockPrisma.postImpression.deleteMany.mockResolvedValue({ count: 7 });

    const summary = await pruneOldPostImpressions();

    expect(summary.deleted).toBe(7);
    const call = mockPrisma.postImpression.deleteMany.mock.calls[0][0];
    const cutoff = call.where.createdAt.lt as Date;
    const daysAgo = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysAgo).toBeCloseTo(45, 0);
  });
});
