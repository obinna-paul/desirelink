import { renderTerms } from "@/lib/spec-test/gender/render";
import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { ARCHETYPE_READINGS_V2 } from "@/lib/spec-test/interpretation/readings-v2";
import { allPatternFlagCopy } from "@/lib/spec-test/interpretation/pattern-flags";
import { ARCHETYPE_KEYS } from "@/lib/spec-test/taxonomy";
import { expectSymmetricTemplate } from "./symmetry-helper";

// Acceptance criteria from docs/spec-test-gender-implementation-plan.md §7 (Phase G2):
// "The G1 symmetry test passes across the full content surface, not just fixtures." This
// exercises every prompt/label/reading/pattern-flag string that exists today, so it fails
// immediately if a future content edit reintroduces a gendered word outside a token, or a
// typo'd token.

describe("item bank content - gender rendering", () => {
  it("renders every prompt under both forms without throwing (no unknown tokens)", () => {
    for (const item of SPEC_TEST_ITEMS_V2) {
      expect(() => renderTerms(item.prompt, "male_user")).not.toThrow();
      expect(() => renderTerms(item.prompt, "female_user")).not.toThrow();
    }
  });

  it("renders every option label under both forms without throwing (no unknown tokens)", () => {
    for (const item of SPEC_TEST_ITEMS_V2) {
      for (const option of item.options) {
        expect(() => renderTerms(option.label, "male_user")).not.toThrow();
        expect(() => renderTerms(option.label, "female_user")).not.toThrow();
      }
    }
  });

  it("leaves no unrendered token in any prompt or label once rendered", () => {
    for (const item of SPEC_TEST_ITEMS_V2) {
      expect(renderTerms(item.prompt, "male_user")).not.toMatch(/[{}]/);
      expect(renderTerms(item.prompt, "female_user")).not.toMatch(/[{}]/);
      for (const option of item.options) {
        expect(renderTerms(option.label, "male_user")).not.toMatch(/[{}]/);
        expect(renderTerms(option.label, "female_user")).not.toMatch(/[{}]/);
      }
    }
  });

  it("is symmetric across forms for every prompt and label - differs only in gendered terms", () => {
    for (const item of SPEC_TEST_ITEMS_V2) {
      expectSymmetricTemplate(item.prompt);
      for (const option of item.options) {
        expectSymmetricTemplate(option.label);
      }
    }
  });
});

describe("archetype readings content - gender rendering", () => {
  const fields = ["tagline", "coreReading", "whatItSaysAboutYou", "strength", "blindSpot", "longTermFit", "growthPrompt"] as const;

  it("renders every reading field under both forms without throwing", () => {
    for (const key of ARCHETYPE_KEYS) {
      const reading = ARCHETYPE_READINGS_V2[key];
      for (const field of fields) {
        expect(() => renderTerms(reading[field], "male_user")).not.toThrow();
        expect(() => renderTerms(reading[field], "female_user")).not.toThrow();
      }
    }
  });

  it("leaves no unrendered token in any reading field once rendered", () => {
    for (const key of ARCHETYPE_KEYS) {
      const reading = ARCHETYPE_READINGS_V2[key];
      for (const field of fields) {
        expect(renderTerms(reading[field], "male_user")).not.toMatch(/[{}]/);
        expect(renderTerms(reading[field], "female_user")).not.toMatch(/[{}]/);
      }
    }
  });

  it("is symmetric across forms for every reading field", () => {
    for (const key of ARCHETYPE_KEYS) {
      const reading = ARCHETYPE_READINGS_V2[key];
      for (const field of fields) {
        expectSymmetricTemplate(reading[field]);
      }
    }
  });
});

describe("pattern-flag copy - gender rendering", () => {
  it("renders every rule's copy under both forms without throwing", () => {
    for (const flag of allPatternFlagCopy()) {
      expect(() => renderTerms(flag.copy, "male_user")).not.toThrow();
      expect(() => renderTerms(flag.copy, "female_user")).not.toThrow();
    }
  });

  it("leaves no unrendered token once rendered", () => {
    for (const flag of allPatternFlagCopy()) {
      expect(renderTerms(flag.copy, "male_user")).not.toMatch(/[{}]/);
      expect(renderTerms(flag.copy, "female_user")).not.toMatch(/[{}]/);
    }
  });

  it("is symmetric across forms for every rule's copy", () => {
    for (const flag of allPatternFlagCopy()) {
      expectSymmetricTemplate(flag.copy);
    }
  });
});
