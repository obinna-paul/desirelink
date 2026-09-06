import { assembleSlate, seededTiebreak, type SlateCandidate } from "@/lib/ranking/slate";

function candidate(id: string, authorId: string, score: number, isLocked = false, hasAffinity?: boolean): SlateCandidate {
  return hasAffinity === undefined ? { id, authorId, score, isLocked } : { id, authorId, score, isLocked, hasAffinity };
}

function ids(result: SlateCandidate[]): string[] {
  return result.map((c) => c.id);
}

describe("assembleSlate", () => {
  it("returns an empty slate for empty input", () => {
    const result = assembleSlate({ ranked: [], exploration: [] }, { seed: "seed" });
    expect(result).toEqual([]);
  });

  it("caps at most one post per creator within any 5 consecutive slots, recovering once the window clears", () => {
    const ranked = [
      candidate("a1", "A", 10),
      candidate("a2", "A", 9),
      candidate("b1", "B", 8),
      candidate("c1", "C", 7),
      candidate("d1", "D", 6),
      candidate("e1", "E", 5),
      candidate("a3", "A", 4),
    ];

    const result = assembleSlate({ ranked, exploration: [] }, { seed: "seed" });

    // a2 is deferred past b1/c1/d1/e1 until A drops out of the trailing-4 window, then
    // placed; a3 never gets a chance since nothing is left to fill the gap before A's
    // window clears again - assembly stops rather than looping.
    expect(ids(result)).toEqual(["a1", "b1", "c1", "d1", "e1", "a2"]);
  });

  it("caps a single creator at 3 posts per session even when the window cap would otherwise allow more", () => {
    const creators = ["X", "P", "Q", "R", "S"];
    const ranked: SlateCandidate[] = [];
    for (let round = 1; round <= 4; round++) {
      for (const author of creators) {
        ranked.push(candidate(`${author.toLowerCase()}${round}`, author, 100 - ranked.length));
      }
    }

    const result = assembleSlate({ ranked, exploration: [] }, { seed: "seed" });

    expect(ids(result)).toEqual([
      "x1", "p1", "q1", "r1", "s1",
      "x2", "p2", "q2", "r2", "s2",
      "x3", "p3", "q3", "r3", "s3",
    ]);
    expect(ids(result)).not.toContain("x4");
    expect(result.filter((c) => c.authorId === "X")).toHaveLength(3);
  });

  it("reserves the last 2 of every 10 slots for the exploration pool", () => {
    const ranked = Array.from({ length: 10 }, (_, i) => candidate(`m${i}`, `M${i}`, 100 - i));
    const exploration = Array.from({ length: 5 }, (_, i) => candidate(`e${i}`, `E${i}`, 1 - i * 0.01));

    const result = assembleSlate({ ranked, exploration }, { seed: "seed", targetLength: 10 });

    expect(ids(result)).toEqual(["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "e0", "e1"]);
  });

  it("caps locked posts at 2 per 10-slot window, deferring the rest to the next window", () => {
    const ranked = [
      candidate("l0", "LA", 100, true, true),
      candidate("l1", "LB", 99, true, true),
      candidate("l2", "LC", 98, true, true),
      candidate("l3", "LD", 97, true, true),
      candidate("u0", "UA", 90),
      candidate("u1", "UB", 89),
      candidate("u2", "UC", 88),
      candidate("u3", "UD", 87),
      candidate("u4", "UE", 86),
      candidate("u5", "UF", 85),
      candidate("u6", "UG", 84),
      candidate("u7", "UH", 83),
    ];

    const result = assembleSlate({ ranked, exploration: [] }, { seed: "seed", targetLength: 11 });

    // l2/l3 are blocked for the rest of the first 10-slot window (l0+l1 already used the
    // quota), filled instead by unlocked posts; l2 is placed as soon as the next window
    // starts at slot index 10, since the locked quota there is fresh.
    expect(ids(result)).toEqual(["l0", "l1", "u0", "u1", "u2", "u3", "u4", "u5", "u6", "u7", "l2"]);
  });

  it("drops locked posts with no affinity toward their creator entirely, regardless of quota", () => {
    const ranked = [candidate("locked-no-affinity", "LX", 100, true, false), candidate("u0", "UA", 50)];

    const result = assembleSlate({ ranked, exploration: [] }, { seed: "seed" });

    expect(ids(result)).toEqual(["u0"]);
  });

  it("never places the same id twice even if it appears in both pools", () => {
    const shared = candidate("dup", "A", 100);
    const result = assembleSlate({ ranked: [shared], exploration: [{ ...shared }] }, { seed: "seed" });

    expect(ids(result)).toEqual(["dup"]);
  });

  it("is deterministic for a fixed seed", () => {
    const ranked = [candidate("x", "A", 5), candidate("y", "B", 5), candidate("z", "C", 5)];

    const first = assembleSlate({ ranked, exploration: [] }, { seed: "same-seed" });
    const second = assembleSlate({ ranked, exploration: [] }, { seed: "same-seed" });

    expect(ids(first)).toEqual(ids(second));
  });

  it("stops at targetLength even with candidates left over", () => {
    const ranked = Array.from({ length: 5 }, (_, i) => candidate(`p${i}`, `P${i}`, 100 - i));

    const result = assembleSlate({ ranked, exploration: [] }, { seed: "seed", targetLength: 2 });

    expect(ids(result)).toEqual(["p0", "p1"]);
  });
});

describe("seededTiebreak", () => {
  it("is a pure function of (seed, id) - same inputs always produce the same output", () => {
    expect(seededTiebreak("seed-a", "post-1")).toBe(seededTiebreak("seed-a", "post-1"));
  });

  it("returns a value in [0, 1)", () => {
    const value = seededTiebreak("seed-a", "post-1");
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it("varies with the seed for the same id", () => {
    expect(seededTiebreak("seed-a", "post-1")).not.toBe(seededTiebreak("seed-b", "post-1"));
  });
});
