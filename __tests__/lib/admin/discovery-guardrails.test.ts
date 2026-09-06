jest.mock("@/lib/prisma", () => ({
  prisma: {
    report: { count: jest.fn() },
    postDailyStats: { findMany: jest.fn() },
    postImpression: { findMany: jest.fn() },
    follow: { findMany: jest.fn() },
    profile: { findMany: jest.fn() },
    subscription: { findMany: jest.fn() },
    providerSubscription: { findMany: jest.fn() },
  },
}));

import { getDiscoveryGuardrails } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  report: { count: jest.Mock };
  postDailyStats: { findMany: jest.Mock };
  postImpression: { findMany: jest.Mock };
  follow: { findMany: jest.Mock };
  profile: { findMany: jest.Mock };
  subscription: { findMany: jest.Mock };
  providerSubscription: { findMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.report.count.mockResolvedValue(0);
  mockPrisma.postDailyStats.findMany.mockResolvedValue([]);
  mockPrisma.postImpression.findMany.mockResolvedValue([]);
  mockPrisma.follow.findMany.mockResolvedValue([]);
  mockPrisma.profile.findMany.mockResolvedValue([]);
  mockPrisma.subscription.findMany.mockResolvedValue([]);
  mockPrisma.providerSubscription.findMany.mockResolvedValue([]);
});

describe("getDiscoveryGuardrails", () => {
  it("returns all zeros when there is no activity in range", async () => {
    const result = await getDiscoveryGuardrails("30d");

    expect(result).toEqual({
      reportRatePer1000Impressions: 0,
      newCreatorReachPct: 0,
      repeatContentRatePct: 0,
      followToSubscribeConversionPct: 0,
      creatorReachGini: 0,
      top1PercentCreatorImpressionSharePct: 0,
      meaningfulDiscoveryRatePct: 0,
      activeViewers: 0,
    });
  });

  it("computes report rate per 1000 impressions", async () => {
    mockPrisma.report.count.mockResolvedValue(3);
    mockPrisma.postDailyStats.findMany.mockResolvedValue([
      { impressions: 150, post: { authorId: "creator-A" } },
    ]);

    const result = await getDiscoveryGuardrails("30d");

    expect(result.reportRatePer1000Impressions).toBe(20);
  });

  it("computes new-creator reach as a share of total impressions", async () => {
    mockPrisma.postDailyStats.findMany.mockResolvedValue([
      { impressions: 100, post: { authorId: "creator-old" } },
      { impressions: 50, post: { authorId: "creator-new" } },
    ]);
    mockPrisma.profile.findMany.mockResolvedValue([{ id: "creator-new" }]);

    const result = await getDiscoveryGuardrails("30d");

    expect(result.newCreatorReachPct).toBeCloseTo(33.33, 1);
  });

  it("computes an even creator split as zero Gini and a 50% top-1% share", async () => {
    mockPrisma.postDailyStats.findMany.mockResolvedValue([
      { impressions: 100, post: { authorId: "creator-A" } },
      { impressions: 100, post: { authorId: "creator-B" } },
    ]);

    const result = await getDiscoveryGuardrails("30d");

    expect(result.creatorReachGini).toBe(0);
    expect(result.top1PercentCreatorImpressionSharePct).toBe(50);
  });

  it("computes repeat-content rate from raw impressions", async () => {
    mockPrisma.postImpression.findMany.mockResolvedValue([
      { viewerId: "viewer-1", post: { authorId: "creator-A" } },
      { viewerId: "viewer-1", post: { authorId: "creator-A" } },
      { viewerId: "viewer-2", post: { authorId: "creator-B" } },
    ]);

    const result = await getDiscoveryGuardrails("30d");

    // 2 of 3 raw impressions belong to a (viewer, creator) pair seen more than once.
    expect(result.repeatContentRatePct).toBeCloseTo(66.67, 1);
  });

  it("computes follow-to-subscribe conversion against existing subscriptions", async () => {
    mockPrisma.follow.findMany.mockResolvedValue([
      { followerId: "viewer-1", followingId: "creator-A" },
      { followerId: "viewer-2", followingId: "creator-B" },
    ]);
    mockPrisma.providerSubscription.findMany.mockResolvedValue([
      { subscriberId: "viewer-1", providerId: "creator-A" },
    ]);

    const result = await getDiscoveryGuardrails("30d");

    expect(result.followToSubscribeConversionPct).toBe(50);
  });

  it("computes meaningful discovery rate as active discoverers over active viewers", async () => {
    mockPrisma.postImpression.findMany.mockResolvedValue([
      { viewerId: "viewer-1", post: { authorId: "creator-A" } },
      { viewerId: "viewer-2", post: { authorId: "creator-B" } },
    ]);
    mockPrisma.follow.findMany.mockResolvedValue([
      { followerId: "viewer-1", followingId: "creator-A" },
    ]);

    const result = await getDiscoveryGuardrails("30d");

    expect(result.activeViewers).toBe(2);
    expect(result.meaningfulDiscoveryRatePct).toBe(50);
  });
});
