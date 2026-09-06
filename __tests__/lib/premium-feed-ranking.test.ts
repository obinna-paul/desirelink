jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    postImpression: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/ranking/people-scoring", () => ({
  getAffinityByCreator: jest.fn(),
}));

import { rankPremiumPosts, selectEligiblePremiumPostIds } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { getAffinityByCreator } from "@/lib/ranking/people-scoring";

const mockPrisma = prisma as unknown as {
  $queryRaw: jest.Mock;
  postImpression: { findMany: jest.Mock };
};
const mockGetAffinityByCreator = getAffinityByCreator as jest.Mock;

type RawPostLike = Parameters<typeof rankPremiumPosts>[0][number];

const NOW = new Date("2026-09-06T12:00:00.000Z");

function post(id: string, authorId: string, createdAt: Date = NOW): RawPostLike {
  return { id, createdAt, author: { id: authorId } } as unknown as RawPostLike;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$queryRaw.mockResolvedValue([]);
  mockPrisma.postImpression.findMany.mockResolvedValue([]);
  mockGetAffinityByCreator.mockResolvedValue(new Map());
});

describe("selectEligiblePremiumPostIds", () => {
  it("returns an empty list without querying when there are no access rows", async () => {
    const result = await selectEligiblePremiumPostIds([], 30);

    expect(result).toEqual([]);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("queries once regardless of how many creators are in the access list, and maps ids in order", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ id: "p1" }, { id: "p2" }, { id: "p3" }]);

    const accessRows = [
      { creatorId: "creator-a", maxTierPriceCents: 500 },
      { creatorId: "creator-b", maxTierPriceCents: null },
      { creatorId: "creator-c", maxTierPriceCents: 1000 },
    ];

    const result = await selectEligiblePremiumPostIds(accessRows, 30);

    expect(result).toEqual(["p1", "p2", "p3"]);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe("rankPremiumPosts", () => {
  it("returns an empty list without querying for an empty post list", async () => {
    const result = await rankPremiumPosts([], "viewer-1", []);

    expect(result).toEqual([]);
    expect(mockPrisma.postImpression.findMany).not.toHaveBeenCalled();
  });

  it("places every unseen post ahead of every seen post, regardless of score", async () => {
    mockPrisma.postImpression.findMany.mockResolvedValue([{ postId: "seen-but-high-affinity" }]);
    mockGetAffinityByCreator.mockResolvedValue(new Map([["high-affinity-author", 1000]]));

    const posts = [
      post("seen-but-high-affinity", "high-affinity-author"),
      post("unseen-plain", "plain-author"),
    ];

    const result = await rankPremiumPosts(posts, "viewer-1", ["high-affinity-author", "plain-author"]);

    expect(result.map((p) => p.id)).toEqual(["unseen-plain", "seen-but-high-affinity"]);
  });

  it("orders unseen posts by freshness + affinity", async () => {
    // recencyTerm at 72h old = 0.25; affinityTerm(60) = 0.75.
    // stale-favorite: 0.5*0.25 + 0.5*0.75 = .5; fresh-stranger: 0.5*1 + 0.5*0 = .5 -> tie,
    // so use a bigger affinity gap to make the comparison unambiguous.
    mockGetAffinityByCreator.mockResolvedValue(new Map([["favorite", 180]])); // affinityTerm = 0.9

    const older = new Date(NOW.getTime() - 72 * 60 * 60 * 1000); // recencyTerm = 0.25
    const posts = [post("stale-favorite", "favorite", older), post("fresh-stranger", "stranger", NOW)];

    const result = await rankPremiumPosts(posts, "viewer-1", ["favorite", "stranger"], NOW);

    // stale-favorite: 0.5*0.25 + 0.5*0.9 = .575; fresh-stranger: 0.5*1 + 0.5*0 = .5
    expect(result.map((p) => p.id)).toEqual(["stale-favorite", "fresh-stranger"]);
  });

  it("queries impressions and affinity scoped to the given viewer and posts", async () => {
    const posts = [post("p1", "author-1")];

    await rankPremiumPosts(posts, "viewer-1", ["author-1", "author-2"]);

    expect(mockPrisma.postImpression.findMany).toHaveBeenCalledWith({
      where: { viewerId: "viewer-1", postId: { in: ["p1"] } },
      select: { postId: true },
    });
    expect(mockGetAffinityByCreator).toHaveBeenCalledWith("viewer-1", ["author-1", "author-2"]);
  });
});
