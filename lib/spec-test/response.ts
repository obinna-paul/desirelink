// Client-safe. The shape of one taker's raw answer to one item - built by the quiz wizard
// (Phase 3) and sent to the submit route (Phase 2), which is the only place it is scored.
// Kept separate from lib/spec-test/taxonomy.ts because it describes wire data, not the
// instrument's config.

export type SpecTestResponseV2 = {
  itemId: string;
  /** null when skipped. Must be one of the item's own option ids - never "A"/"B"/"C"/"D",
   *  since options are presented in randomized order (docs/spec-test-research.md §5
   *  item-writing rules: "Randomize answer order when technically feasible"). */
  optionId: string | null;
  /** Where this option was rendered (0-3) at answer time - null when skipped. Used for
   *  position-bias analysis, never for scoring. */
  presentedIndex: number | null;
  /** Time from this item's render to the taker's choice, in milliseconds. */
  elapsedMs: number;
  skipped?: boolean;
};

export type BestWorstResponseV3 = {
  itemId: string;
  kind: "best_worst";
  bestOptionId: string | null;
  worstOptionId: string | null;
  bestPresentedIndex: number | null;
  worstPresentedIndex: number | null;
  elapsedMs: number;
  skipped?: boolean;
};

export type IntensityResponseV3 = {
  itemId: string;
  kind: "intensity";
  /** Seven-point scale. Four is the explicitly neutral midpoint. */
  rating: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  elapsedMs: number;
  skipped?: boolean;
};

export type SingleChoiceResponseV3 = {
  itemId: string;
  kind: "single_choice";
  optionId: string | null;
  presentedIndex: number | null;
  elapsedMs: number;
  skipped?: boolean;
};

export type SpecTestResponseV3 =
  | BestWorstResponseV3
  | IntensityResponseV3
  | SingleChoiceResponseV3;
