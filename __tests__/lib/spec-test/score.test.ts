import { ARCHETYPE_CENTROIDS, ALPHA, SIGMA } from "@/lib/spec-test/scoring/archetypes";
import { archetypeDistances, archetypeProbabilities, rankedArchetypes, computeScoringVector, motiveScoresFromVector, motiveFacetsFromVector } from "@/lib/spec-test/scoring/score";
import { CLEAR_MARGIN } from "@/lib/spec-test/scoring/decide";
import { ARCHETYPE_KEYS, SCORING_DIMENSION_KEYS } from "@/lib/spec-test/taxonomy";
import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";

// Acceptance criteria from docs/spec-test-v2-implementation-plan.md §6.

describe("archetype centroid self-resolution", () => {
  it("resolves every archetype's own centroid as its own top match", () => {
    for (const key of ARCHETYPE_KEYS) {
      const centroid = ARCHETYPE_CENTROIDS[key];
      const distances = archetypeDistances(centroid);
      const probabilities = archetypeProbabilities(distances);
      const [top] = rankedArchetypes(probabilities);
      expect(top).toBe(key);
      expect(distances[key]).toBeCloseTo(0, 6);
    }
  });

  it("does not resolve a midpoint between two very different archetypes with a clear margin", () => {
    const a = ARCHETYPE_CENTROIDS.quiet_fire;
    const b = ARCHETYPE_CENTROIDS.electric_charmer;
    const midpoint = Object.fromEntries(
      SCORING_DIMENSION_KEYS.map((key) => [key, (a[key] + b[key]) / 2]),
    ) as typeof a;

    const probabilities = archetypeProbabilities(archetypeDistances(midpoint));
    const ranked = rankedArchetypes(probabilities);
    const margin = probabilities[ranked[0]] - probabilities[ranked[1]];
    expect(margin).toBeLessThan(CLEAR_MARGIN);
  });
});

describe("ALPHA/SIGMA config sanity", () => {
  it("covers every scoring dimension with a positive weight and spread", () => {
    for (const key of SCORING_DIMENSION_KEYS) {
      expect(ALPHA[key]).toBeGreaterThan(0);
      expect(SIGMA[key]).toBeGreaterThan(0);
    }
  });
});

function itemById(itemId: string) {
  const item = SPEC_TEST_ITEMS_V2.find((i) => i.id === itemId);
  if (!item) throw new Error(`unknown item ${itemId}`);
  return item;
}

function answered(itemId: string, suffix: "a" | "b" | "c" | "d", elapsedMs = 3000): SpecTestResponseV2 {
  const item = itemById(itemId);
  const index = ["a", "b", "c", "d"].indexOf(suffix);
  return { itemId, optionId: item.options[index].id, presentedIndex: index, elapsedMs };
}

function skipped(itemId: string): SpecTestResponseV2 {
  return { itemId, optionId: null, presentedIndex: null, elapsedMs: 0, skipped: true };
}

describe("exposure-normalized motive scoring", () => {
  it("scores exactly 100 on a dimension when every measuring item's matching option is chosen", () => {
    // reliabilityReciprocity [R] is loaded by first-date-danger-d and profile-investigate-d.
    const items = [itemById("first-date-danger"), itemById("profile-investigate")];
    const responses = [answered("first-date-danger", "d"), answered("profile-investigate", "d")];
    const vector = computeScoringVector(items, responses);
    expect(vector.reliabilityReciprocity).toBe(100);
  });

  it("scores 0 on a dimension whose measuring items were all answered with a different option", () => {
    const items = [itemById("first-date-danger"), itemById("profile-investigate")];
    const responses = [answered("first-date-danger", "a"), answered("profile-investigate", "a")];
    const vector = computeScoringVector(items, responses);
    expect(vector.reliabilityReciprocity).toBe(0);
  });

  it("a skipped item reduces the denominator instead of counting as a wrong answer", () => {
    const items = [itemById("first-date-danger"), itemById("profile-investigate")];

    // Skip case: only one item measures R and it's answered correctly -> 100%, not penalized
    // for the skipped item the way a wrong answer would be.
    const skipResponses = [answered("first-date-danger", "d"), skipped("profile-investigate")];
    const skipVector = computeScoringVector(items, skipResponses);
    expect(skipVector.reliabilityReciprocity).toBe(100);

    // Wrong-answer case: both items measure R, only one matches -> 50%.
    const wrongResponses = [answered("first-date-danger", "d"), answered("profile-investigate", "a")];
    const wrongVector = computeScoringVector(items, wrongResponses);
    expect(wrongVector.reliabilityReciprocity).toBe(50);

    expect(skipVector.reliabilityReciprocity).toBeGreaterThan(wrongVector.reliabilityReciprocity);
  });

  it("defaults a dimension with no measuring item in the given subset to 50 (neutral)", () => {
    // Neither item in this subset has a socialVitality-loading option.
    const items = [itemById("first-date-danger")];
    const responses = [answered("first-date-danger", "d")];
    const vector = computeScoringVector(items, responses);
    expect(vector.socialVitality).toBe(50);
  });

  it("keeps every dimension within [0, 100]", () => {
    const responses: SpecTestResponseV2[] = SPEC_TEST_ITEMS_V2.map((item) => answered(item.id, "a"));
    const vector = computeScoringVector(SPEC_TEST_ITEMS_V2, responses);
    for (const key of SCORING_DIMENSION_KEYS) {
      expect(vector[key]).toBeGreaterThanOrEqual(0);
      expect(vector[key]).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic - identical responses produce an identical vector", () => {
    const responses: SpecTestResponseV2[] = SPEC_TEST_ITEMS_V2.map((item, i) => answered(item.id, (["a", "b", "c", "d"] as const)[i % 4]));
    const first = computeScoringVector(SPEC_TEST_ITEMS_V2, responses);
    const second = computeScoringVector(SPEC_TEST_ITEMS_V2, [...responses]);
    expect(first).toEqual(second);
  });
});

describe("combined intrigue motive score", () => {
  it("averages the two facets into the report's combined intrigue_selective_access key", () => {
    const vector = computeScoringVector(SPEC_TEST_ITEMS_V2, SPEC_TEST_ITEMS_V2.map((item) => answered(item.id, "a")));
    const motives = motiveScoresFromVector(vector);
    expect(motives.intrigueSelectiveAccess).toBeCloseTo((vector.containedDepthPrivacy + vector.aestheticSelectivity) / 2, 6);
    const facets = motiveFacetsFromVector(vector);
    expect(facets.containedDepthPrivacy).toBe(vector.containedDepthPrivacy);
    expect(facets.aestheticSelectivity).toBe(vector.aestheticSelectivity);
  });
});
