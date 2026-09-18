import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { computeForcedChoiceProfile } from "@/lib/spec-test/scoring/forced-choice";
import { ARCHETYPE_KEYS } from "@/lib/spec-test/taxonomy";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";

function responsesForOptionIndexes(indexes: number[]): SpecTestResponseV2[] {
  return SPEC_TEST_ITEMS_V2.map((item, itemIndex) => ({
    itemId: item.id,
    optionId: item.options[indexes[itemIndex] ?? 0].id,
    presentedIndex: indexes[itemIndex] ?? 0,
    elapsedMs: 3_000,
  }));
}

describe("spec-v2.2 forced-choice scoring", () => {
  it("is deterministic and produces a normalized archetype distribution", () => {
    const indexes = SPEC_TEST_ITEMS_V2.map((_, index) => index % 4);
    const first = computeForcedChoiceProfile(SPEC_TEST_ITEMS_V2, responsesForOptionIndexes(indexes));
    const second = computeForcedChoiceProfile(SPEC_TEST_ITEMS_V2, responsesForOptionIndexes(indexes));

    expect(second).toEqual(first);
    expect(first.probabilities[first.ranked[0]]).toBeGreaterThanOrEqual(first.probabilities[first.ranked[1]]);
    expect(Object.values(first.probabilities).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  it("gives every archetype zero expected evidence under exact uniform choice per item", () => {
    // Average four complete response sets, one choosing each canonical position. Every item
    // is therefore answered uniformly across its alternatives by construction.
    const profiles = [0, 1, 2, 3].map((optionIndex) =>
      computeForcedChoiceProfile(
        SPEC_TEST_ITEMS_V2,
        responsesForOptionIndexes(SPEC_TEST_ITEMS_V2.map(() => optionIndex)),
      ),
    );

    for (const archetype of ARCHETYPE_KEYS) {
      const averageRawEvidence =
        profiles.reduce((sum, profile) => sum + profile.evidence[archetype].rawEvidence, 0) /
        profiles.length;
      expect(averageRawEvidence).toBeCloseTo(0, 10);
    }
  });

  it("omits a skipped item symmetrically instead of changing only four dimensions' denominators", () => {
    const indexes = SPEC_TEST_ITEMS_V2.map((_, index) => index % 4);
    const responses = responsesForOptionIndexes(indexes);
    const skipped = responses.map((answer, index) =>
      index === 0 ? { ...answer, optionId: null, presentedIndex: null, skipped: true } : answer,
    );
    const profile = computeForcedChoiceProfile(SPEC_TEST_ITEMS_V2, skipped);

    for (const archetype of ARCHETYPE_KEYS) {
      // Four attachment items never enter this model; one skipped motive item leaves 19.
      expect(profile.evidence[archetype].answeredItems).toBe(19);
    }
  });
});
