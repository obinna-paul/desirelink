// Client-safe. The two optional, unscored context questions from
// docs/spec-test-research.md §5 "Optional context questions" (1 and 2). Question 3 there is
// an optional birthday/zodiac side note - explicitly deferred, see
// docs/spec-test-v2-implementation-plan.md §1.2 "Non-goals for v2.0": it carries zero
// scoring weight by design, so it's pure UI delight that can ship on its own schedule.
//
// Answers here are never scored (taxonomy.ts's motives/lenses/archetypes never reference
// them) - they exist purely to let interpretation copy adjust its advice to context, per
// report §3 Layer D: "Someone seeking casual connection can still be a Soft Landing."

export type ContextQuestionOption = {
  id: string;
  label: string;
};

export type ContextQuestionV2 = {
  id: string;
  prompt: string;
  options: ContextQuestionOption[];
};

export const SPEC_TEST_CONTEXT_QUESTIONS_V2: ContextQuestionV2[] = [
  {
    id: "openTo",
    prompt: "What are you open to right now?",
    options: [
      { id: "exploring", label: "Exploring" },
      { id: "casual", label: "Casual connection" },
      { id: "relationship", label: "A relationship" },
      { id: "longTerm", label: "Long-term partnership" },
      { id: "notSure", label: "Not sure" },
    ],
  },
  {
    id: "currentChapter",
    prompt: "Which best describes your current chapter?",
    options: [
      { id: "single", label: "Single" },
      { id: "talking", label: "Talking to someone" },
      { id: "dating", label: "Dating" },
      { id: "partnered", label: "Partnered" },
      { id: "married", label: "Married or committed" },
    ],
  },
];
