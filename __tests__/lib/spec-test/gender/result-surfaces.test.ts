// Phase G5 (docs/spec-test-gender-implementation-plan.md §10): the result page, email, and
// share card all consume lib/spec-test/results.ts's already-rendered copy, so this phase is
// mostly a verification pass rather than new code. The result page and email paths are
// exercised end-to-end in __tests__/lib/spec-test/results.test.ts and
// __tests__/lib/email-spec-test-result.test.ts (both extended in G3) - this file covers the
// one G5-specific claim that wasn't yet asserted anywhere: that the share card
// (app/spec-test/result/[id]/opengraph-image.tsx) is a genuine no-op across forms, not just
// an assumption, because it only ever reads `copy.headline.name` (a proper noun, never
// templated) and `copy.headline.tagline` (templated, but per the report's §10 "carries no
// gendered referent").

import { renderTerms } from "@/lib/spec-test/gender/render";
import { ARCHETYPE_READINGS_V2 } from "@/lib/spec-test/interpretation/readings-v2";
import { ARCHETYPE_KEYS } from "@/lib/spec-test/taxonomy";

describe("Phase G5 - share card is a no-op across forms", () => {
  it("renders every archetype's headline name identically regardless of form (never templated)", () => {
    for (const key of ARCHETYPE_KEYS) {
      const { name } = ARCHETYPE_READINGS_V2[key];
      expect(name).not.toMatch(/[{}]/);
    }
  });

  it("renders every archetype's tagline byte-identical across male_user and female_user - not just symmetric", () => {
    for (const key of ARCHETYPE_KEYS) {
      const { tagline } = ARCHETYPE_READINGS_V2[key];
      const maleUserRender = renderTerms(tagline, "male_user");
      const femaleUserRender = renderTerms(tagline, "female_user");
      // A stricter check than the cross-content symmetry test: taglines must carry literally
      // no gendered referent at all, so the two forms don't just parallel each other, they
      // are the exact same string - proving the share card needs no per-form logic.
      expect(maleUserRender).toBe(tagline);
      expect(femaleUserRender).toBe(tagline);
      expect(maleUserRender).toBe(femaleUserRender);
    }
  });
});
