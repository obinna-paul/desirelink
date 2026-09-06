jest.mock("@/lib/prisma", () => ({
  prisma: {
    postDailyStats: { findMany: jest.fn() },
    profile: { findMany: jest.fn() },
    postQuality: { upsert: jest.fn() },
  },
}));

import { refreshPostQuality } from "@/lib/post-quality";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  postDailyStats: { findMany: jest.Mock };
  profile: { findMany: jest.Mock };
  postQuality: { upsert: jest.Mock };
};

const NOW = new Date("2026-09-06T12:00:00.000Z");
const OLD_DATE = new Date("2026-08-20T00:00:00.000Z"); // within 30d window, before the 3d recent window
const RECENT_DATE = new Date("2026-09-05T00:00:00.000Z"); // within the trailing 3 days

function statRow(postId: string, authorId: string, date: Date, impressions: number, weightedEngagement: number) {
  return { postId, date, impressions, weightedEngagement, post: { authorId } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.postDailyStats.findMany.mockResolvedValue([]);
  mockPrisma.profile.findMany.mockResolvedValue([]);
});

describe("refreshPostQuality", () => {
  it("does nothing when there's no activity in the trailing 30 days", async () => {
    const summary = await refreshPostQuality(NOW);

    expect(summary).toEqual({ postsUpdated: 0, priorRate: 0 });
    expect(mockPrisma.postQuality.upsert).not.toHaveBeenCalled();
  });

  it("smooths low-volume posts toward a fresh platform-wide prior, high-volume posts barely move", async () => {
    mockPrisma.postDailyStats.findMany.mockResolvedValue([
      statRow("post-A", "author-A", OLD_DATE, 50, 50), // own rate 1.0, large volume
      statRow("post-B", "author-B", OLD_DATE, 50, 0), // own rate 0.0, large volume
    ]);
    mockPrisma.profile.findMany.mockResolvedValue([
      { id: "author-A", communityStanding: 100 },
      { id: "author-B", communityStanding: 0 },
    ]);

    const summary = await refreshPostQuality(NOW);

    // platform-wide: weighted 50 / impressions 100 = 0.5
    expect(summary).toEqual({ postsUpdated: 2, priorRate: 0.5 });

    // smoothedEngagementRate(A) = (50 + 50*0.5) / (50 + 50) = 0.75; velocity defaults to 1
    // (no recent-window activity); trust = 0.85 + 0.15*(100/100) = 1.0 -> quality = 0.75
    expect(mockPrisma.postQuality.upsert).toHaveBeenCalledWith({
      where: { postId: "post-A" },
      create: {
        postId: "post-A",
        quality: 0.75,
        smoothedEngagementRate: 0.75,
        velocityMultiplier: 1,
        trustMultiplier: 1,
        impressions30d: 50,
      },
      update: {
        quality: 0.75,
        smoothedEngagementRate: 0.75,
        velocityMultiplier: 1,
        trustMultiplier: 1,
        impressions30d: 50,
      },
    });

    // smoothedEngagementRate(B) = (0 + 50*0.5) / (50 + 50) = 0.25; trust = 0.85 + 0.15*0 = 0.85
    // -> quality = 0.25 * 1 * 0.85 = 0.2125
    expect(mockPrisma.postQuality.upsert).toHaveBeenCalledWith({
      where: { postId: "post-B" },
      create: {
        postId: "post-B",
        quality: 0.2125,
        smoothedEngagementRate: 0.25,
        velocityMultiplier: 1,
        trustMultiplier: 0.85,
        impressions30d: 50,
      },
      update: {
        quality: 0.2125,
        smoothedEngagementRate: 0.25,
        velocityMultiplier: 1,
        trustMultiplier: 0.85,
        impressions30d: 50,
      },
    });
  });

  it("computes velocityMultiplier from a recent spike, clamped to [0.5, 2.0]", async () => {
    mockPrisma.postDailyStats.findMany.mockResolvedValue([
      statRow("post-C", "author-C", OLD_DATE, 100, 10),
      statRow("post-C", "author-C", RECENT_DATE, 100, 90),
    ]);
    mockPrisma.profile.findMany.mockResolvedValue([{ id: "author-C", communityStanding: 50 }]);

    const summary = await refreshPostQuality(NOW);

    // platform-wide: weighted 100 / impressions 200 = 0.5
    expect(summary).toEqual({ postsUpdated: 1, priorRate: 0.5 });

    // smoothedEngagementRate = (100 + 50*0.5) / (200 + 50) = 0.5
    // recentRate = (90 + 50*0.5) / (100 + 50) = 115/150 = 23/30
    // velocityMultiplier = clamp((23/30) / 0.5, 0.5, 2.0) = 23/15
    // trust = 0.85 + 0.15*0.5 = 0.925
    // quality = 0.5 * (23/15) * 0.925 = 851/1200
    expect(mockPrisma.postQuality.upsert).toHaveBeenCalledTimes(1);
    const call = mockPrisma.postQuality.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ postId: "post-C" });
    expect(call.create.smoothedEngagementRate).toBeCloseTo(0.5, 10);
    expect(call.create.velocityMultiplier).toBeCloseTo(23 / 15, 10);
    expect(call.create.trustMultiplier).toBeCloseTo(0.925, 10);
    expect(call.create.quality).toBeCloseTo(851 / 1200, 10);
    expect(call.create.impressions30d).toBe(200);
  });

  it("defaults velocityMultiplier to 1 when recent-window impressions are below the minimum sample size", async () => {
    mockPrisma.postDailyStats.findMany.mockResolvedValue([
      statRow("post-D", "author-D", OLD_DATE, 100, 10),
      statRow("post-D", "author-D", RECENT_DATE, 2, 2), // below MIN_RECENT_IMPRESSIONS (5)
    ]);
    mockPrisma.profile.findMany.mockResolvedValue([{ id: "author-D", communityStanding: 0 }]);

    await refreshPostQuality(NOW);

    const call = mockPrisma.postQuality.upsert.mock.calls[0][0];
    expect(call.create.velocityMultiplier).toBe(1);
  });

  it("defaults trustMultiplier to the untrusted floor when the author profile can't be found", async () => {
    mockPrisma.postDailyStats.findMany.mockResolvedValue([statRow("post-E", "author-missing", OLD_DATE, 10, 5)]);
    mockPrisma.profile.findMany.mockResolvedValue([]);

    await refreshPostQuality(NOW);

    const call = mockPrisma.postQuality.upsert.mock.calls[0][0];
    expect(call.create.trustMultiplier).toBe(0.85);
  });

  it("passes the 30-day window and author ids to prisma", async () => {
    mockPrisma.postDailyStats.findMany.mockResolvedValue([statRow("post-F", "author-F", OLD_DATE, 10, 5)]);

    await refreshPostQuality(NOW);

    expect(mockPrisma.postDailyStats.findMany).toHaveBeenCalledWith({
      where: { date: { gte: new Date("2026-08-07T12:00:00.000Z") } },
      select: {
        postId: true,
        date: true,
        impressions: true,
        weightedEngagement: true,
        post: { select: { authorId: true } },
      },
    });
    expect(mockPrisma.profile.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["author-F"] } },
      select: { id: true, communityStanding: true },
    });
  });
});
