// Not a test suite itself (no .test. in the filename) - a reusable assertion imported by
// render.test.ts here in G1, and intended for reuse in G2's content-pass tests once real
// item/reading copy exists (docs/spec-test-gender-implementation-plan.md §7 acceptance
// criteria: "The G1 symmetry test passes across the full content surface, not just
// fixtures").

import { renderTerms } from "@/lib/spec-test/gender/render";
import { TERM_TABLES } from "@/lib/spec-test/gender/terms";
import type { QuizForm } from "@/lib/spec-test/gender/forms";

const FORM_PAIR: readonly [QuizForm, QuizForm] = ["male_user", "female_user"];

/** Replaces every gendered word this form's table can produce with a common placeholder, so
 *  two renderings that differ only in which words were substituted become byte-identical. */
function normalize(rendered: string, form: QuizForm): string {
  const values = Array.from(new Set(Object.values(TERM_TABLES[form])));
  // Longest-first so e.g. "herself" is fully consumed before the shorter "her" would
  // otherwise match inside what's left of it.
  const sorted = values.sort((a, b) => b.length - a.length);

  let result = rendered;
  for (const value of sorted) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "✦");
  }
  return result;
}

/**
 * Renders `template` under both forms and asserts the results are identical once each
 * form's own gendered words are replaced with a common placeholder - i.e. the two forms can
 * differ only in the gendered terms themselves, never in tone, structure, or length
 * (plan §6 principle 3, §7 acceptance criteria).
 */
export function expectSymmetricTemplate(template: string): void {
  const [formA, formB] = FORM_PAIR;
  const normalizedA = normalize(renderTerms(template, formA), formA);
  const normalizedB = normalize(renderTerms(template, formB), formB);
  expect(normalizedA).toBe(normalizedB);
}
