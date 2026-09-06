jest.mock("@/lib/prisma", () => ({
  prisma: {
    creatorAffinity: { findMany: jest.fn() },
    postQuality: { findMany: jest.fn() },
    postHashtag: { findMany: jest.fn() },
    feedSlate: { findUnique: jest.fn(), create: jest.fn() },
  },
}));
jest.mock("@/lib/hashtag-affinity", () => ({
  getViewerHashtagAffinity: jest.fn(),
  postHashtagAffinity: jest.requireActual("@/lib/hashtag-affinity").postHashtagAffinity,
}));

import { HOME_FEED_SESSION_SEED, isFeedRankingEnabled, isInRankingHoldout, rankFeedPosts } from "@/lib/ranking/engine";
import { prisma } from "@/lib/prisma";
import { getViewerHashtagAffinity } from "@/lib/hashtag-affinity";

const mockPrisma = prisma as unknown as {
  creatorAffinity: { findMany: jest.Mock };
  postQuality: { findMany: jest.Mock };
  postHashtag: { findMany: jest.Mock };
  feedSlate: { findUnique: jest.Mock; create: jest.Mock };
};

const NOW = new Date("2026-09-06T12:00:00.000Z");
const BUCKET_START = new Date("2026-09-06T12:00:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.creatorAffinity.findMany.mockResolvedValue([]);
  mockPrisma.postQuality.findMany.mockResolvedValue([]);
  mockPrisma.postHashtag.findMany.mockResolvedValue([]);
  (getViewerHashtagAffinity as jest.Mock).mockResolvedValue(new Map());
  mockPrisma.feedSlate.findUnique.mockResolvedValue(null);
  mockPrisma.feedSlate.create.mockResolvedValue({});
});

describe("isFeedRankingEnabled", () => {
  const original = process.env.FEED_RANKING_ENABLED;
  afterEach(() => {
    process.env.FEED_RANKING_ENABLED = original;
  });

  it("is true when unset", () => {
    delete process.env.FEED_RANKING_ENABLED;
    expect(isFeedRankingEnabled()).toBe(true);
  });

  it("supports an explicit false kill switch", () => {
    process.env.FEED_RANKING_ENABLED = "false";
    expect(isFeedRankingEnabled()).toBe(false);
    process.env.FEED_RANKING_ENABLED = "0";
    expect(isFeedRankingEnabled()).toBe(false);
  });

  it("is true when explicitly enabled", () => {
    process.env.FEED_RANKING_ENABLED = "true";
    expect(isFeedRankingEnabled()).toBe(true);
  });
});

describe("isInRankingHoldout", () => {
  it("is deterministic for a given viewer", () => {
    expect(isInRankingHoldout("viewer-1")).toBe(isInRankingHoldout("viewer-1"));
  });

  it("holds out roughly a 10% share, both in and out of holdout across many viewers", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `viewer-${i}`);
    const inHoldout = ids.filter((id) => isInRankingHoldout(id));

    expect(inHoldout.length).toBeGreaterThan(0);
    expect(inHoldout.length).toBeLessThan(ids.length);
    // loose bounds around the 10% target - this is a hash-based split, not exact
    expect(inHoldout.length).toBeLessThan(ids.length * 0.3);
  });
});

describe("rankFeedPosts", () => {
  it("returns an empty list without touching prisma when there are no candidates", async () => {
    const result = await rankFeedPosts("viewer-1", HOME_FEED_SESSION_SEED, [], NOW);

    expect(result).toEqual([]);
    expect(mockPrisma.creatorAffinity.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.feedSlate.findUnique).not.toHaveBeenCalled();
  });

  it("reuses an existing frozen slate without recomputing affinity/quality/scores", async () => {
    mockPrisma.feedSlate.findUnique.mockResolvedValue({ postIds: ["reused-1", "reused-2"] });

    const result = await rankFeedPosts(
      "viewer-1",
      HOME_FEED_SESSION_SEED,
      [{ id: "p1", authorId: "A", createdAt: NOW, locked: false }],
      NOW,
    );

    expect(result).toEqual(["reused-1", "reused-2"]);
    expect(mockPrisma.creatorAffinity.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.postQuality.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.feedSlate.create).not.toHaveBeenCalled();
  });

  it("scores, assembles, and persists a new slate reordering higher-affinity posts first", async () => {
    mockPrisma.creatorAffinity.findMany.mockResolvedValue([{ creatorId: "A", affinity: 20 }]);
    mockPrisma.postQuality.findMany.mockResolvedValue([
      { postId: "p1", quality: 1 },
      { postId: "p2", quality: 1 },
    ]);

    const posts = [
      { id: "p1", authorId: "A", createdAt: NOW, locked: false },
      { id: "p2", authorId: "B", createdAt: NOW, locked: false },
    ];

    const result = await rankFeedPosts("viewer-1", HOME_FEED_SESSION_SEED, posts, NOW);

    // p1: affinity 0.5, quality 0.5, recency 1 -> 0.475. p2: affinity 0, quality 0.5, recency 1 -> 0.3.
    expect(result).toEqual(["p1", "p2"]);
    expect(mockPrisma.creatorAffinity.findMany).toHaveBeenCalledWith({
      where: { viewerId: "viewer-1", creatorId: { in: ["A", "B"] } },
      select: { creatorId: true, affinity: true },
    });
    expect(mockPrisma.postQuality.findMany).toHaveBeenCalledWith({
      where: { postId: { in: ["p1", "p2"] } },
      select: { postId: true, quality: true },
    });
    expect(mockPrisma.postHashtag.findMany).toHaveBeenCalledWith({
      where: { postId: { in: ["p1", "p2"] } },
      select: { postId: true, hashtag: { select: { tag: true } } },
    });
    expect(mockPrisma.feedSlate.create).toHaveBeenCalledWith({
      data: { viewerId: "viewer-1", sessionSeed: HOME_FEED_SESSION_SEED, bucketStart: BUCKET_START, postIds: ["p1", "p2"] },
    });
  });

  it("uses hashtag behavior to break an otherwise tied feed score", async () => {
    mockPrisma.postHashtag.findMany.mockResolvedValue([
      { postId: "p-topic", hashtag: { tag: "lagosnightlife" } },
      { postId: "p-other", hashtag: { tag: "food" } },
    ]);
    (getViewerHashtagAffinity as jest.Mock).mockResolvedValue(
      new Map([["lagosnightlife", 8]]),
    );

    const posts = [
      { id: "p-other", authorId: "B", createdAt: NOW, locked: false },
      { id: "p-topic", authorId: "A", createdAt: NOW, locked: false },
    ];
    const result = await rankFeedPosts("viewer-1", HOME_FEED_SESSION_SEED, posts, NOW);

    expect(result[0]).toBe("p-topic");
  });

  it("drops a locked post with zero affinity toward its creator from the ranked result", async () => {
    mockPrisma.creatorAffinity.findMany.mockResolvedValue([]);
    mockPrisma.postQuality.findMany.mockResolvedValue([]);

    const posts = [
      { id: "locked", authorId: "stranger", createdAt: NOW, locked: true },
      { id: "unlocked", authorId: "other", createdAt: NOW, locked: false },
    ];

    const result = await rankFeedPosts("viewer-1", HOME_FEED_SESSION_SEED, posts, NOW);

    expect(result).toEqual(["unlocked"]);
  });
});
