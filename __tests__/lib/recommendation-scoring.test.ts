import { affinityTerm, qualityTerm, recencyTerm, scoreCandidates, scorePost, topicAffinityTerm, SCORE_WEIGHTS } from "@/lib/recommendation-scoring";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-09-06T12:00:00.000Z");

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * HOUR);
}

describe("SCORE_WEIGHTS", () => {
  it("uses creator, type, topic, quality, and recency signals without renormalizing", () => {
    expect(SCORE_WEIGHTS).toEqual({ affinity: 0.3, type: 0.15, topic: 0.15, quality: 0.25, recency: 0.15 });
  });
});

describe("topicAffinityTerm", () => {
  it("preserves zero and reaches 0.5 at eight raw topic units", () => {
    expect(topicAffinityTerm(0)).toBe(0);
    expect(topicAffinityTerm(8)).toBe(0.5);
  });

  it("preserves negative topic feedback", () => {
    expect(topicAffinityTerm(-8)).toBe(-0.5);
  });
});

describe("affinityTerm", () => {
  it("is 0 for a viewer with no affinity toward this creator", () => {
    expect(affinityTerm(0)).toBe(0);
  });

  it("saturates toward 1 as raw affinity grows, reaching 0.5 at the saturation point (20)", () => {
    expect(affinityTerm(20)).toBe(0.5);
  });

  it("gives a moderate raw affinity (8) a partial, not dominant, term", () => {
    expect(affinityTerm(8)).toBeCloseTo(8 / 28, 10);
  });

  it("preserves negative affinity so explicit disinterest lowers a creator's rank", () => {
    expect(affinityTerm(-5)).toBeCloseTo(-5 / 25, 10);
  });
});

describe("qualityTerm", () => {
  it("is 0 when the post has no PostQuality row yet", () => {
    expect(qualityTerm(0)).toBe(0);
  });

  it("reaches 0.5 at the saturation point (1)", () => {
    expect(qualityTerm(1)).toBe(0.5);
  });

  it("scales continuously below saturation", () => {
    expect(qualityTerm(0.25)).toBeCloseTo(0.2, 10);
  });
});

describe("recencyTerm", () => {
  it("is 1 for a post published this instant", () => {
    expect(recencyTerm(NOW, NOW)).toBe(1);
  });

  it("halves at the 36-hour half-life", () => {
    expect(recencyTerm(hoursAgo(36), NOW)).toBeCloseTo(0.5, 10);
  });

  it("halves again at 72 hours", () => {
    expect(recencyTerm(hoursAgo(72), NOW)).toBeCloseTo(0.25, 10);
  });
});

describe("scorePost", () => {
  it("degrades gracefully to quality + recency for a viewer with zero affinity", () => {
    const result = scorePost(
      { id: "post-1", authorId: "author-1", authorProfileType: "EXPLORER", rawAffinity: 0, rawTopicAffinity: 0, rawQuality: 0, publishedAt: hoursAgo(36), isLocked: false },
      NOW,
    );

    // affinity=0, quality=0, recency=0.5 -> score = 0.15*0.5 = 0.075
    expect(result).toEqual({ score: 0.075, affinity: 0, type: 0, topic: 0, quality: 0, recency: 0.5, penalty: 0 });
  });

  it("combines all terms for an engaged viewer and a fresh, high-quality post", () => {
    const result = scorePost(
      { id: "post-2", authorId: "author-2", authorProfileType: "EXPLORER", rawAffinity: 20, rawTopicAffinity: 0, rawQuality: 1, publishedAt: NOW, isLocked: false },
      NOW,
    );

    // 0.3*0.5 + 0.25*0.5 + 0.15*1 = 0.15 + 0.125 + 0.15 = 0.425
    expect(result).toMatchObject({ affinity: 0.5, type: 0, topic: 0, quality: 0.5, recency: 1, penalty: 0 });
    expect(result.score).toBeCloseTo(0.425, 10);
  });

  it("uses hashtag affinity as a real ranking signal", () => {
    const result = scorePost(
      { id: "post-topic", authorId: "author", authorProfileType: "EXPLORER", rawAffinity: 0, rawTopicAffinity: 8, rawQuality: 0, publishedAt: NOW, isLocked: false },
      NOW,
    );

    expect(result.topic).toBe(0.5);
    // 0.15*0.5 + 0.15*1 = 0.075 + 0.15 = 0.225
    expect(result.score).toBeCloseTo(0.225, 10);
  });

  it("uses the viewer's/author's profile type as a real ranking signal", () => {
    const noType = scorePost(
      { id: "post-type", authorId: "author", authorProfileType: "SEEKER", rawAffinity: 0, rawTopicAffinity: 0, rawQuality: 0, publishedAt: NOW, isLocked: false },
      NOW,
      null,
    );
    const matchedType = scorePost(
      { id: "post-type", authorId: "author", authorProfileType: "SEEKER", rawAffinity: 0, rawTopicAffinity: 0, rawQuality: 0, publishedAt: NOW, isLocked: false },
      NOW,
      "SEEKER",
    );

    expect(noType.type).toBe(0);
    expect(matchedType.type).toBe(1);
    // no-type: 0.15*1(recency) = 0.15; matched: 0.15*1(type) + 0.15*1(recency) = 0.3
    expect(noType.score).toBeCloseTo(0.15, 10);
    expect(matchedType.score).toBeCloseTo(0.3, 10);
  });

  it("fully penalizes locked content for a viewer with zero affinity toward that creator", () => {
    const result = scorePost(
      { id: "post-3", authorId: "author-3", authorProfileType: "EXPLORER", rawAffinity: 0, rawTopicAffinity: 0, rawQuality: 0, publishedAt: NOW, isLocked: true },
      NOW,
    );

    // recency=1 -> 0.15*1 = 0.15; penalty = 0.15*(1-0) = 0.15 -> score cancels to 0
    expect(result).toEqual({ score: 0, affinity: 0, type: 0, topic: 0, quality: 0, recency: 1, penalty: 0.15 });
  });

  it("scales the locked penalty down as affinity for that creator grows", () => {
    const result = scorePost(
      { id: "post-4", authorId: "author-4", authorProfileType: "EXPLORER", rawAffinity: 20, rawTopicAffinity: 0, rawQuality: 0, publishedAt: NOW, isLocked: true },
      NOW,
    );

    // affinity=0.5 -> penalty = 0.15*(1-0.5) = 0.075
    // score = 0.3*0.5 + 0 + 0.15*1 - 0.075 = 0.15 + 0.15 - 0.075 = 0.225
    expect(result.affinity).toBe(0.5);
    expect(result.quality).toBe(0);
    expect(result.recency).toBe(1);
    expect(result.penalty).toBeCloseTo(0.075, 10);
    expect(result.score).toBeCloseTo(0.225, 10);
  });
});

describe("scoreCandidates", () => {
  it("sorts descending by score", () => {
    const posts = [
      { id: "low", authorId: "a", authorProfileType: "EXPLORER" as const, rawAffinity: 0, rawTopicAffinity: 0, rawQuality: 0, publishedAt: hoursAgo(72), isLocked: false },
      { id: "high", authorId: "b", authorProfileType: "EXPLORER" as const, rawAffinity: 20, rawTopicAffinity: 0, rawQuality: 1, publishedAt: NOW, isLocked: false },
    ];

    const ranked = scoreCandidates(posts, NOW);

    expect(ranked.map((p) => p.id)).toEqual(["high", "low"]);
  });

  it("breaks a tied score by publishedAt, newest first", () => {
    const posts = [
      { id: "older", authorId: "a", authorProfileType: "EXPLORER" as const, rawAffinity: 0, rawTopicAffinity: 0, rawQuality: 0, publishedAt: hoursAgo(10), isLocked: false },
      { id: "newer", authorId: "a", authorProfileType: "EXPLORER" as const, rawAffinity: 0, rawTopicAffinity: 0, rawQuality: 0, publishedAt: hoursAgo(10), isLocked: false },
    ];
    posts[1].publishedAt = new Date(posts[0].publishedAt.getTime() + 1);

    const ranked = scoreCandidates(posts, NOW);

    expect(ranked.map((p) => p.id)).toEqual(["newer", "older"]);
  });

  it("threads the viewer's profile type through to every candidate", () => {
    const posts = [
      { id: "seeker-post", authorId: "a", authorProfileType: "SEEKER" as const, rawAffinity: 0, rawTopicAffinity: 0, rawQuality: 0, publishedAt: NOW, isLocked: false },
      { id: "creator-post", authorId: "b", authorProfileType: "CREATOR" as const, rawAffinity: 0, rawTopicAffinity: 0, rawQuality: 0, publishedAt: NOW, isLocked: false },
    ];

    const ranked = scoreCandidates(posts, NOW, "SEEKER");

    expect(ranked.map((p) => p.id)).toEqual(["seeker-post", "creator-post"]);
  });
});
