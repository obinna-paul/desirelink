import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import {
  decideSpecTestResult,
  decideSpecTestResultForVersion,
  decideSpecTestResultV22,
  V22_MIN_SPLIT_ITEMS_PER_SECTION,
} from "@/lib/spec-test/scoring/decide";
import { searchArchetypeReachability } from "@/lib/spec-test/scoring/diagnostics";
import {
  INSTRUMENT_VERSION,
  LEGACY_INSTRUMENT_VERSION_V2_1,
} from "@/lib/spec-test/taxonomy";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";

function responsesFromOptionIds(optionIds: string[]): SpecTestResponseV2[] {
  return SPEC_TEST_ITEMS_V2.map((item, index) => {
    const optionId = optionIds.find((candidate) => item.options.some((option) => option.id === candidate));
    const fallback = item.options[index % item.options.length].id;
    const selected = optionId ?? fallback;
    return {
      itemId: item.id,
      optionId: selected,
      presentedIndex: item.options.findIndex((option) => option.id === selected),
      elapsedMs: 3_000 + index * 25,
    };
  });
}

describe("spec-v2.2 result decision", () => {
  it("routes old instrument versions to the preserved v2.1 classifier", () => {
    const pattern = searchArchetypeReachability(SPEC_TEST_ITEMS_V2, "electric_charmer", {
      restarts: 8,
      seed: 13,
    });
    const responses = responsesFromOptionIds(pattern.optionIds);

    expect(
      decideSpecTestResultForVersion(LEGACY_INSTRUMENT_VERSION_V2_1, SPEC_TEST_ITEMS_V2, responses),
    ).toEqual(decideSpecTestResult(SPEC_TEST_ITEMS_V2, responses));
  });

  it("routes the current instrument to forced-choice-native scoring", () => {
    const pattern = searchArchetypeReachability(SPEC_TEST_ITEMS_V2, "electric_charmer", {
      restarts: 12,
      seed: 17,
    });
    const responses = responsesFromOptionIds(pattern.optionIds);

    expect(decideSpecTestResultForVersion(INSTRUMENT_VERSION, SPEC_TEST_ITEMS_V2, responses)).toEqual(
      decideSpecTestResultV22(SPEC_TEST_ITEMS_V2, responses),
    );
  });

  it("does not let the four-item Partnership section force a split", () => {
    expect(SPEC_TEST_ITEMS_V2.filter((item) => item.section === "partnership")).toHaveLength(4);
    expect(V22_MIN_SPLIT_ITEMS_PER_SECTION).toBeGreaterThan(4);

    const pattern = searchArchetypeReachability(SPEC_TEST_ITEMS_V2, "free_spirit", {
      restarts: 12,
      seed: 23,
    });
    const result = decideSpecTestResultV22(SPEC_TEST_ITEMS_V2, responsesFromOptionIds(pattern.optionIds));
    if (result.quality === "usable") expect(result.confidence).not.toBe("split");
  });

  it("maps chance-centered motive scores around 50 instead of 25", () => {
    const pattern = searchArchetypeReachability(SPEC_TEST_ITEMS_V2, "grounded_equal", {
      restarts: 12,
      seed: 29,
    });
    const result = decideSpecTestResultV22(SPEC_TEST_ITEMS_V2, responsesFromOptionIds(pattern.optionIds));
    if (result.quality !== "usable") throw new Error("expected a usable targeted response pattern");

    const scores = Object.values(result.motiveScores);
    expect(scores.some((score) => score > 50)).toBe(true);
    expect(scores.some((score) => score < 50)).toBe(true);
  });
});
