/**
 * Ranking sanity test, per the discovery/ranking plan's verification section: a fixture
 * corpus with a known-correct expected order, asserted end-to-end through the engine
 * (rankFeedPosts -> scoreCandidates -> assembleSlate -> getOrBuildSlate persistence), not
 * just each piece in isolation. Every score below is picked to be strictly distinct from
 * every other, so the expected order is unambiguous - see the comments for the exact
 * arithmetic, and the slot-by-slot trace in this PR's description.
 */
jest.mock("@/lib/prisma", () => ({
  prisma: {
    creatorAffinity: { findMany: jest.fn() },
    postQuality: { findMany: jest.fn() },
    feedSlate: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

import { rankFeedPosts } from "@/lib/ranking/engine";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  creatorAffinity: { findMany: jest.Mock };
  postQuality: { findMany: jest.Mock };
  feedSlate: { findUnique: jest.Mock; create: jest.Mock };
};

const NOW = new Date("2026-09-06T12:00:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.feedSlate.findUnique.mockResolvedValue(null);
  mockPrisma.feedSlate.create.mockResolvedValue({});
});

describe("ranking sanity: a realistic multi-creator, multi-signal corpus", () => {
  it("produces the known-correct order end-to-end", async () => {
    // Every post is posted at NOW (recency term = 1 for all), so this corpus isolates
    // affinity/quality/lock behavior without recency also moving the order - recency's own
    // math is already covered in recommendation-scoring.test.ts.
    const posts = [
      { id: "a1", authorId: "A", createdAt: NOW, locked: false },
      { id: "a2", authorId: "A", createdAt: NOW, locked: false },
      { id: "b1", authorId: "B", createdAt: NOW, locked: false },
      { id: "b2", authorId: "B", createdAt: NOW, locked: false },
      { id: "c1", authorId: "C", createdAt: NOW, locked: false },
      { id: "locked-d", authorId: "D", createdAt: NOW, locked: true },
      { id: "e1", authorId: "E", createdAt: NOW, locked: false },
      { id: "locked-f-no-affinity", authorId: "F", createdAt: NOW, locked: true },
    ];

    // Affinity is per (viewer, creator) - every post from the same creator shares its raw
    // affinity. E and F have no row at all (0 raw affinity, saturates to 0).
    mockPrisma.creatorAffinity.findMany.mockResolvedValue([
      { creatorId: "A", affinity: 60 }, // affinityTerm = 60/80 = 0.75
      { creatorId: "B", affinity: 20 }, // affinityTerm = 20/40 = 0.5
      { creatorId: "C", affinity: 20 }, // affinityTerm = 20/40 = 0.5
      { creatorId: "D", affinity: 20 }, // affinityTerm = 20/40 = 0.5
    ]);
    mockPrisma.postQuality.findMany.mockResolvedValue([
      { postId: "a1", quality: 3 }, // qualityTerm = 3/4 = 0.75
      { postId: "a2", quality: 1 }, // qualityTerm = 1/2 = 0.5
      { postId: "b1", quality: 3 }, // 0.75
      { postId: "b2", quality: 0.25 }, // qualityTerm = 0.25/1.25 = 0.2
      { postId: "c1", quality: 1 }, // 0.5
      { postId: "locked-d", quality: 1 }, // 0.5
      { postId: "e1", quality: 1 }, // 0.5
      { postId: "locked-f-no-affinity", quality: 3 }, // irrelevant - dropped before scoring
    ]);

    // score = 0.35*affinity + 0.30*quality + 0.15*recency(=1 for all) - penalty
    // a1:       .35*.75 + .30*.75 + .15        = .6375
    // a2:       .35*.75 + .30*.50 + .15        = .5625
    // b1:       .35*.50 + .30*.75 + .15        = .5500
    // c1:       .35*.50 + .30*.50 + .15        = .4750
    // locked-d: (.35*.50 + .30*.50 + .15) - .15*(1-.50) = .4750 - .075 = .4000
    // b2:       .35*.50 + .30*.20 + .15        = .3850
    // e1:       .35*0   + .30*.50 + .15        = .3000
    // locked-f-no-affinity: dropped outright (locked, zero affinity toward F) - never scored.
    const result = await rankFeedPosts("viewer-1", "sanity-session", posts, NOW);

    // Every score above is strictly distinct, so this order is the ONLY correct one for
    // score alone; the trace below confirms the creator cap doesn't change it, only defers
    // a2/b2 a few slots later than their raw score rank would otherwise place them.
    expect(result).toEqual(["a1", "b1", "c1", "locked-d", "e1", "a2", "b2"]);

    // The zero-affinity locked post must never appear, regardless of everything else.
    expect(result).not.toContain("locked-f-no-affinity");

    // The creator cap (at most 1 per creator in any 5 consecutive slots) deferred A's and
    // B's second post away from immediately trailing their first.
    expect(result.indexOf("a2") - result.indexOf("a1")).toBeGreaterThanOrEqual(4);
    expect(result.indexOf("b2") - result.indexOf("b1")).toBeGreaterThanOrEqual(2);

    // Ranking and persistence agree - the slate written is exactly what was returned.
    expect(mockPrisma.feedSlate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ postIds: result }) }),
    );
  });
});
