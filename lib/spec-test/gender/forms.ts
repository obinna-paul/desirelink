// Client-safe. The gender routing layer (docs/spec-test-gender-report.md §3, §9;
// docs/spec-test-gender-implementation-plan.md §6 Phase G1). Gender routes which
// presentation form a taker sees - it must never reach scoring. See
// __tests__/lib/spec-test/gender/scoring-boundary.test.ts for the structural guarantee that
// lib/spec-test/scoring and lib/spec-test/interpretation cannot import anything from here.

export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

/** Named for who the form is FOR (the taker), not for whose pictures/referents appear in it -
 *  see docs/spec-test-gender-implementation-plan.md §5's schema comment. There are no image
 *  stimuli in this instrument (§1.2 non-goals), so "form" here only ever changes rendered
 *  text. */
export const QUIZ_FORMS = ["male_user", "female_user"] as const;
export type QuizForm = (typeof QUIZ_FORMS)[number];

/**
 * Named per docs/spec-test-gender-report.md's own routing-rule identifier, and kept as a
 * stored, versioned constant rather than inline logic - a future rule (e.g. one driven by a
 * stated attraction target instead of an assumption from gender) is then a new named rule
 * plus a question, not a refactor (plan §2 principle 2).
 */
export const ROUTING_RULE = "heterosexual_v0_1" as const;

export type RoutingResult = {
  quizForm: QuizForm;
  /** What the product ASSUMED, never what the user declared - report §9 is explicit that
   *  this must never be stored or treated as a stated sexual orientation. */
  assumedAttractionTarget: Gender;
  routingRule: typeof ROUTING_RULE;
};

/**
 * The only routing rule this version implements (report §3):
 *   male   -> assumed attraction target female -> male_user form
 *   female -> assumed attraction target male   -> female_user form
 * This is a disclosed product assumption (report §Exec: "a product decision, not a
 * scientific conclusion that gender determines attraction target"), not a measurement.
 */
export function routeForm(gender: Gender): RoutingResult {
  const assumedAttractionTarget: Gender = gender === "male" ? "female" : "male";
  const quizForm: QuizForm = gender === "male" ? "male_user" : "female_user";
  return { quizForm, assumedAttractionTarget, routingRule: ROUTING_RULE };
}
