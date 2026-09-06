jest.mock("@/lib/prisma", () => ({
  prisma: {
    feedSlate: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

import { bucketStartFor, getOrBuildSlate, getSlatePage } from "@/lib/feed-slate";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  feedSlate: { findUnique: jest.Mock; create: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("bucketStartFor", () => {
  it("floors to the 15-minute boundary", () => {
    expect(bucketStartFor(new Date("2026-09-06T12:07:59.000Z"))).toEqual(new Date("2026-09-06T12:00:00.000Z"));
    expect(bucketStartFor(new Date("2026-09-06T12:14:59.999Z"))).toEqual(new Date("2026-09-06T12:00:00.000Z"));
    expect(bucketStartFor(new Date("2026-09-06T12:15:00.000Z"))).toEqual(new Date("2026-09-06T12:15:00.000Z"));
    expect(bucketStartFor(new Date("2026-09-06T12:29:00.000Z"))).toEqual(new Date("2026-09-06T12:15:00.000Z"));
  });
});

describe("getOrBuildSlate", () => {
  const NOW = new Date("2026-09-06T12:07:00.000Z");
  const BUCKET_START = new Date("2026-09-06T12:00:00.000Z");
  const WHERE = { viewerId_sessionSeed_bucketStart: { viewerId: "viewer-1", sessionSeed: "session-1", bucketStart: BUCKET_START } };

  it("returns the existing slate without calling buildPostIds", async () => {
    mockPrisma.feedSlate.findUnique.mockResolvedValue({ postIds: ["p1", "p2"] });
    const buildPostIds = jest.fn();

    const result = await getOrBuildSlate("viewer-1", "session-1", buildPostIds, NOW);

    expect(result).toEqual({ postIds: ["p1", "p2"], bucketStart: BUCKET_START, reused: true });
    expect(buildPostIds).not.toHaveBeenCalled();
    expect(mockPrisma.feedSlate.create).not.toHaveBeenCalled();
    expect(mockPrisma.feedSlate.findUnique).toHaveBeenCalledWith({ where: WHERE, select: { postIds: true } });
  });

  it("builds and persists a new slate when none exists for this bucket", async () => {
    mockPrisma.feedSlate.findUnique.mockResolvedValue(null);
    mockPrisma.feedSlate.create.mockResolvedValue({});
    const buildPostIds = jest.fn().mockResolvedValue(["p1", "p2", "p3"]);

    const result = await getOrBuildSlate("viewer-1", "session-1", buildPostIds, NOW);

    expect(result).toEqual({ postIds: ["p1", "p2", "p3"], bucketStart: BUCKET_START, reused: false });
    expect(buildPostIds).toHaveBeenCalledTimes(1);
    expect(mockPrisma.feedSlate.create).toHaveBeenCalledWith({
      data: { viewerId: "viewer-1", sessionSeed: "session-1", bucketStart: BUCKET_START, postIds: ["p1", "p2", "p3"] },
    });
  });

  it("reads back the winner's slate on a concurrent-create race (P2002)", async () => {
    mockPrisma.feedSlate.findUnique
      .mockResolvedValueOnce(null) // first check: no slate yet
      .mockResolvedValueOnce({ postIds: ["winner-1", "winner-2"] }); // re-read after losing the race
    mockPrisma.feedSlate.create.mockRejectedValue({ code: "P2002" });
    const buildPostIds = jest.fn().mockResolvedValue(["mine-1"]);

    const result = await getOrBuildSlate("viewer-1", "session-1", buildPostIds, NOW);

    expect(result).toEqual({ postIds: ["winner-1", "winner-2"], bucketStart: BUCKET_START, reused: true });
    expect(mockPrisma.feedSlate.findUnique).toHaveBeenCalledTimes(2);
  });

  it("rethrows a create error that isn't a unique-constraint race", async () => {
    mockPrisma.feedSlate.findUnique.mockResolvedValue(null);
    mockPrisma.feedSlate.create.mockRejectedValue(new Error("connection reset"));
    const buildPostIds = jest.fn().mockResolvedValue(["p1"]);

    await expect(getOrBuildSlate("viewer-1", "session-1", buildPostIds, NOW)).rejects.toThrow("connection reset");
  });
});

describe("getSlatePage", () => {
  const NOW = new Date("2026-09-06T12:07:00.000Z");
  const BUCKET_START = new Date("2026-09-06T12:00:00.000Z");

  it("returns an empty page with no slate for the current bucket", async () => {
    mockPrisma.feedSlate.findUnique.mockResolvedValue(null);

    const result = await getSlatePage("viewer-1", "session-1", 0, 10, NOW);

    expect(result).toEqual({ postIds: [], hasMore: false, bucketStart: null });
  });

  it("slices the frozen slate by offset/limit and reports hasMore", async () => {
    mockPrisma.feedSlate.findUnique.mockResolvedValue({ postIds: ["p1", "p2", "p3", "p4", "p5"] });

    const firstPage = await getSlatePage("viewer-1", "session-1", 0, 2, NOW);
    expect(firstPage).toEqual({ postIds: ["p1", "p2"], hasMore: true, bucketStart: BUCKET_START });

    const lastPage = await getSlatePage("viewer-1", "session-1", 4, 2, NOW);
    expect(lastPage).toEqual({ postIds: ["p5"], hasMore: false, bucketStart: BUCKET_START });
  });

  it("clamps a negative offset to 0", async () => {
    mockPrisma.feedSlate.findUnique.mockResolvedValue({ postIds: ["p1", "p2"] });

    const result = await getSlatePage("viewer-1", "session-1", -5, 2, NOW);

    expect(result).toEqual({ postIds: ["p1", "p2"], hasMore: false, bucketStart: BUCKET_START });
  });
});
