import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { OPTION_MOTIVE_LOADINGS, OPTION_ATTACHMENT_LOADINGS, ATTACHMENT_ITEM_IDS, TENSION_ITEM_PAIRS } from "@/lib/spec-test/scoring/loadings";
import { SCORING_DIMENSION_KEYS } from "@/lib/spec-test/taxonomy";

// Acceptance criteria from docs/spec-test-v2-implementation-plan.md §6: "Every option in the
// bank has at least one motive loading... no orphan options... no loadings referencing an
// unknown motive or item" - checked as data integrity, not by manual review.

describe("spec test v2 item bank integrity", () => {
  it("has no duplicate item ids", () => {
    const ids = SPEC_TEST_ITEMS_V2.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate option ids across the whole bank", () => {
    const optionIds = SPEC_TEST_ITEMS_V2.flatMap((item) => item.options.map((option) => option.id));
    expect(new Set(optionIds).size).toBe(optionIds.length);
  });

  it("gives every non-attachment option exactly one known scoring-dimension loading", () => {
    for (const item of SPEC_TEST_ITEMS_V2) {
      if (ATTACHMENT_ITEM_IDS.includes(item.id)) continue;
      for (const option of item.options) {
        const dimension = OPTION_MOTIVE_LOADINGS[option.id];
        expect(dimension).toBeDefined();
        expect(SCORING_DIMENSION_KEYS).toContain(dimension);
      }
    }
  });

  it("gives every attachment option a known anxiety/avoidance loading and no motive loading", () => {
    for (const item of SPEC_TEST_ITEMS_V2) {
      if (!ATTACHMENT_ITEM_IDS.includes(item.id)) continue;
      for (const option of item.options) {
        expect(OPTION_ATTACHMENT_LOADINGS[option.id]).toBeDefined();
        expect(OPTION_MOTIVE_LOADINGS[option.id]).toBeUndefined();
      }
    }
  });

  it("has no loadings that reference an option absent from the bank (no orphans)", () => {
    const knownOptionIds = new Set(SPEC_TEST_ITEMS_V2.flatMap((item) => item.options.map((option) => option.id)));
    for (const optionId of Object.keys(OPTION_MOTIVE_LOADINGS)) {
      expect(knownOptionIds.has(optionId)).toBe(true);
    }
    for (const optionId of Object.keys(OPTION_ATTACHMENT_LOADINGS)) {
      expect(knownOptionIds.has(optionId)).toBe(true);
    }
  });

  it("covers every scoring dimension with at least one option across the non-attachment bank", () => {
    const covered = new Set(Object.values(OPTION_MOTIVE_LOADINGS));
    for (const dimension of SCORING_DIMENSION_KEYS) {
      expect(covered.has(dimension)).toBe(true);
    }
  });

  it("keeps option labels within a rough length tolerance of each other per item (report §5 item-writing rules)", () => {
    for (const item of SPEC_TEST_ITEMS_V2) {
      const lengths = item.options.map((option) => option.label.length);
      const max = Math.max(...lengths);
      const min = Math.min(...lengths);
      // Generous tolerance - the rule is "roughly equal", not identical; this catches an
      // option that is dramatically shorter/longer than its siblings, a common tell for an
      // unintentionally "correct-sounding" option.
      expect(max - min).toBeLessThanOrEqual(90);
    }
  });

  it("declares at least two tension item pairs, both present in the bank", () => {
    expect(TENSION_ITEM_PAIRS.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(SPEC_TEST_ITEMS_V2.map((item) => item.id));
    for (const [a, b] of TENSION_ITEM_PAIRS) {
      expect(ids.has(a)).toBe(true);
      expect(ids.has(b)).toBe(true);
    }
  });

  it("does not leak bracketed motive codes into any user-facing prompt or label", () => {
    for (const item of SPEC_TEST_ITEMS_V2) {
      expect(item.prompt).not.toMatch(/\[[A-Za-z-]+\]/);
      for (const option of item.options) {
        expect(option.label).not.toMatch(/\[[A-Za-z-]+\]/);
      }
    }
  });
});
