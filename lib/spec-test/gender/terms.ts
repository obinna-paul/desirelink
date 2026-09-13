// Client-safe. The approved token vocabulary and its three term tables
// (docs/spec-test-gender-implementation-plan.md §6). Every gendered referent in item/reading/
// pattern-flag copy is written using ONLY these tokens - see render.ts for how they're
// substituted, and __tests__/lib/spec-test/gender/render.test.ts for the symmetry test this
// closed vocabulary makes possible: render both forms of any template, and they can differ
// only in these terms, never in tone, length, or content.

import type { QuizForm } from "@/lib/spec-test/gender/forms";

export const TOKEN_KEYS = ["person", "people", "they", "them", "their", "theirs", "themself", "personPoss"] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];

/** male_user/female_user render the OTHER person (the one described in the item or reading -
 *  never the taker) as female/male respectively. "neutral" is used for any pre-gender v2.0
 *  row with no stored form, and as render.ts's safety fallback. */
export type RenderForm = QuizForm | "neutral";

type TermTable = Record<TokenKey, string>;

export const TERM_TABLES: Record<RenderForm, TermTable> = {
  male_user: {
    person: "woman",
    people: "women",
    they: "she",
    them: "her",
    their: "her",
    theirs: "hers",
    themself: "herself",
    personPoss: "woman's",
  },
  female_user: {
    person: "man",
    people: "men",
    they: "he",
    them: "him",
    their: "his",
    theirs: "his",
    themself: "himself",
    personPoss: "man's",
  },
  neutral: {
    person: "person",
    people: "people",
    they: "they",
    them: "them",
    their: "their",
    theirs: "theirs",
    themself: "themself",
    personPoss: "person's",
  },
};
