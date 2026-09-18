import { renderTerms } from "@/lib/spec-test/gender/render";
import {
  SPEC_TEST_ITEMS_V3,
  V3_INSTRUMENT_VERSION,
} from "@/lib/spec-test/items/spec-v3";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import {
  V3_PILOT_BLOCK_DIMENSIONS,
  V3_PILOT_INTENSITY_DIMENSIONS,
} from "@/lib/spec-test/scoring/pilot-v3";
import { decideSpecTestResultV3, V3_DIMENSION_ARCHETYPE } from "@/lib/spec-test/scoring/v3";
import { ARCHETYPE_KEYS, SCORING_DIMENSION_KEYS, type ScoringDimensionKey } from "@/lib/spec-test/taxonomy";

function responsesFor(target: ScoringDimensionKey | null): SpecTestResponseV3[] {
  return SPEC_TEST_ITEMS_V3.map((item, itemIndex) => {
    if (item.kind === "best_worst") {
      const dimensions = V3_PILOT_BLOCK_DIMENSIONS[item.id];
      const targetIndex = target ? dimensions.indexOf(target) : -1;
      const bestIndex = targetIndex >= 0 ? targetIndex : itemIndex % 4;
      const worstIndex = [0, 1, 2, 3].find((index) => index !== bestIndex) ?? 0;
      return {
        itemId: item.id,
        kind: "best_worst",
        bestOptionId: item.options[bestIndex].id,
        worstOptionId: item.options[worstIndex].id,
        bestPresentedIndex: bestIndex,
        worstPresentedIndex: worstIndex,
        elapsedMs: 2500,
      };
    }
    if (item.kind === "intensity") {
      const dimension = V3_PILOT_INTENSITY_DIMENSIONS[item.id];
      return {
        itemId: item.id,
        kind: "intensity",
        rating: target === null ? 4 : dimension === target ? 7 : 2,
        elapsedMs: 1800,
      };
    }
    return {
      itemId: item.id,
      kind: "single_choice",
      optionId: item.options[0].id,
      presentedIndex: 0,
      elapsedMs: 1700,
    };
  });
}

describe("official spec-v3.0 instrument", () => {
  it("contains exactly 28 questions in the 16 + 8 + 4 design", () => {
    expect(V3_INSTRUMENT_VERSION).toBe("spec-v3.0");
    expect(SPEC_TEST_ITEMS_V3.filter((item) => item.kind === "best_worst")).toHaveLength(16);
    expect(SPEC_TEST_ITEMS_V3.filter((item) => item.kind === "intensity")).toHaveLength(8);
    expect(SPEC_TEST_ITEMS_V3.filter((item) => item.kind === "single_choice")).toHaveLength(4);
  });

  it("keeps prompts and options short enough for a conversational mobile quiz", () => {
    for (const item of SPEC_TEST_ITEMS_V3) {
      expect(item.prompt.trim().split(/\s+/).length).toBeLessThanOrEqual(20);
      if (item.kind !== "intensity") {
        for (const option of item.options) {
          expect(option.label.trim().split(/\s+/).length).toBeLessThanOrEqual(16);
        }
      }
    }
  });

  it("renders gendered wording without leaking template braces", () => {
    const text = SPEC_TEST_ITEMS_V3.flatMap((item) => [
      item.prompt,
      ...(item.kind === "intensity" ? [] : item.options.map((option) => option.label)),
    ]);
    for (const template of text) {
      expect(renderTerms(template, "male_user")).not.toMatch(/[{}]/);
      expect(renderTerms(template, "female_user")).not.toMatch(/[{}]/);
    }
    expect(renderTerms("The {person} keeps {their} word.", "male_user")).toBe("The woman keeps her word.");
    expect(renderTerms("The {person} keeps {their} word.", "female_user")).toBe("The man keeps his word.");
  });

  it.each(SCORING_DIMENSION_KEYS)("makes the %s archetype reachable", (dimension) => {
    const decision = decideSpecTestResultV3(SPEC_TEST_ITEMS_V3, responsesFor(dimension));
    expect(decision.confidence).not.toBe("low_signal");
    if (decision.confidence !== "low_signal") {
      expect(decision.primarySpec).toBe(V3_DIMENSION_ARCHETYPE[dimension]);
    }
  });

  it("maps the eight dimensions one-to-one onto all eight public archetypes", () => {
    expect(new Set(Object.values(V3_DIMENSION_ARCHETYPE))).toEqual(new Set(ARCHETYPE_KEYS));
  });

  it("withholds a branded result when the profile has no meaningful spread", () => {
    const responses = responsesFor(null).map((response) =>
      response.kind === "best_worst" ? { ...response, skipped: true, bestOptionId: null, worstOptionId: null, bestPresentedIndex: null, worstPresentedIndex: null } : response,
    );
    const decision = decideSpecTestResultV3(SPEC_TEST_ITEMS_V3, responses);
    expect(decision.confidence).toBe("low_signal");
  });
});
