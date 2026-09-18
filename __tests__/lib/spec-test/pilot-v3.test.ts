import {
  SPEC_TEST_ITEMS_V3_PILOT,
  V3_PILOT_BEST_WORST_ITEMS,
  V3_PILOT_INTENSITY_ITEMS,
  V3_PILOT_UNCERTAINTY_ITEMS,
} from "@/lib/spec-test/items/spec-v3-pilot";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import {
  V3_PILOT_BLOCK_DIMENSIONS,
  V3_PILOT_INTENSITY_DIMENSIONS,
  analyzeV3PilotBank,
  scoreV3PilotAttraction,
  scoreV3PilotUncertainty,
  validateV3PilotResponses,
} from "@/lib/spec-test/scoring/pilot-v3";
import { SCORING_DIMENSION_KEYS } from "@/lib/spec-test/taxonomy";

describe("spec-v3 pilot model", () => {
  it("has the planned 16 + 8 + 4 structure and globally unique ids", () => {
    expect(V3_PILOT_BEST_WORST_ITEMS).toHaveLength(16);
    expect(V3_PILOT_INTENSITY_ITEMS).toHaveLength(8);
    expect(V3_PILOT_UNCERTAINTY_ITEMS).toHaveLength(4);
    expect(SPEC_TEST_ITEMS_V3_PILOT).toHaveLength(28);

    const itemIds = SPEC_TEST_ITEMS_V3_PILOT.map((item) => item.id);
    const optionIds = SPEC_TEST_ITEMS_V3_PILOT.flatMap((item) =>
      item.kind === "intensity" ? [] : item.options.map((option) => option.id),
    );
    expect(new Set(itemIds).size).toBe(itemIds.length);
    expect(new Set(optionIds).size).toBe(optionIds.length);
  });

  it("balances motive exposure and varies every opponent pairing", () => {
    const diagnostics = analyzeV3PilotBank();
    for (const dimension of SCORING_DIMENSION_KEYS) {
      expect(diagnostics.dimensionExposure[dimension]).toBe(8);
    }
    expect(Object.keys(diagnostics.pairExposure)).toHaveLength(28);
    expect(diagnostics.minPairExposure).toBe(3);
    expect(diagnostics.maxPairExposure).toBe(4);
  });

  it("gives every comparative block four unique dimensions and every dimension one anchor", () => {
    for (const item of V3_PILOT_BEST_WORST_ITEMS) {
      const dimensions = V3_PILOT_BLOCK_DIMENSIONS[item.id];
      expect(dimensions).toHaveLength(4);
      expect(new Set(dimensions).size).toBe(4);
    }
    expect(Object.values(V3_PILOT_INTENSITY_DIMENSIONS).sort()).toEqual([...SCORING_DIMENSION_KEYS].sort());
  });

  it("keeps choices within a rough wording-length tolerance inside each block", () => {
    for (const item of [...V3_PILOT_BEST_WORST_ITEMS, ...V3_PILOT_UNCERTAINTY_ITEMS]) {
      const lengths = item.options.map((option) => option.label.length);
      expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(45);
    }
  });

  it("rejects selecting the same option as both most and least", () => {
    const item = V3_PILOT_BEST_WORST_ITEMS[0];
    const response: SpecTestResponseV3 = {
      itemId: item.id,
      kind: "best_worst",
      bestOptionId: item.options[0].id,
      worstOptionId: item.options[0].id,
      bestPresentedIndex: 0,
      worstPresentedIndex: 0,
      elapsedMs: 2_000,
    };
    expect(validateV3PilotResponses([item], [response])).toContain(`same_best_worst:${item.id}`);
  });

  it("scores best as +1, worst as -1, and the seven-point anchor around zero", () => {
    const block = V3_PILOT_BEST_WORST_ITEMS[0];
    const anchor = V3_PILOT_INTENSITY_ITEMS[0];
    const responses: SpecTestResponseV3[] = [
      {
        itemId: block.id,
        kind: "best_worst",
        bestOptionId: block.options[0].id,
        worstOptionId: block.options[1].id,
        bestPresentedIndex: 0,
        worstPresentedIndex: 1,
        elapsedMs: 3_000,
      },
      { itemId: anchor.id, kind: "intensity", rating: 7, elapsedMs: 1_500 },
    ];
    const profile = scoreV3PilotAttraction([block, anchor], responses);
    expect(profile.warmthResponsiveness).toMatchObject({
      comparativeRaw: 1,
      comparativeExposure: 1,
      comparativeScore: 1,
      intensityScore: 1,
      combinedScore: 1,
    });
    expect(profile.socialVitality.comparativeScore).toBe(-1);
    expect(profile.socialVitality.intensityScore).toBeNull();
  });

  it("keeps uncertainty responses out of attraction and reports them separately", () => {
    const item = V3_PILOT_UNCERTAINTY_ITEMS[0];
    const responses: SpecTestResponseV3[] = [
      {
        itemId: item.id,
        kind: "single_choice",
        optionId: item.options[2].id,
        presentedIndex: 2,
        elapsedMs: 2_500,
      },
    ];
    const attraction = scoreV3PilotAttraction([item], responses);
    for (const dimension of SCORING_DIMENSION_KEYS) {
      expect(attraction[dimension].combinedScore).toBeNull();
    }
    expect(scoreV3PilotUncertainty([item], responses)).toEqual({
      steadyUnderUncertainty: 0,
      reassuranceSensitive: 0,
      spaceProtective: 1,
      pushPull: 0,
    });
  });

  it("can require one response record per item without requiring every item to be answered", () => {
    const item = V3_PILOT_INTENSITY_ITEMS[0];
    expect(validateV3PilotResponses([item], [], { requireComplete: true })).toEqual([
      `missing_response:${item.id}`,
    ]);
    const skipped: SpecTestResponseV3 = {
      itemId: item.id,
      kind: "intensity",
      rating: null,
      elapsedMs: 1_000,
      skipped: true,
    };
    expect(validateV3PilotResponses([item], [skipped], { requireComplete: true })).toEqual([]);
  });

  it("requires skipped records to contain no hidden answer", () => {
    const item = V3_PILOT_INTENSITY_ITEMS[0];
    const invalidSkip: SpecTestResponseV3 = {
      itemId: item.id,
      kind: "intensity",
      rating: 7,
      elapsedMs: 1_000,
      skipped: true,
    };
    expect(validateV3PilotResponses([item], [invalidSkip])).toEqual([`invalid_skip:${item.id}`]);
  });
});
