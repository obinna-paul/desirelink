import "server-only";

// server-only. Implements the eight conditional "dating-history" rules from
// docs/spec-test-research.md §7 ("Conditional dating-history rules... trigger them only when
// multiple answers converge"). The report names each rule's trigger only in prose (e.g. "high
// intrigue + high reassurance sensitivity") - it never defines numeric thresholds against our
// specific motive/lens/attachment keys, so the mapping below is an explicit interpretive
// judgment call, same spirit as the archetype centroids in scoring/archetypes.ts. Every rule
// requires at least two converging conditions, per the report's own instruction and
// docs/spec-test-v2-implementation-plan.md §9's acceptance criteria.
//
// Copy strings are quoted directly from the report's §7 table - they already carry the
// hedge ("may have", "may sometimes") the report requires, so nothing is added on top.

import type { AttachmentScore } from "@/lib/spec-test/scoring/score";
import type { LensKey, MotiveKey } from "@/lib/spec-test/taxonomy";

const HIGH = 65;
const LOW = 35;

export type PatternFlagId =
  | "ambiguity_amplification"
  | "caretaking_imbalance"
  | "fast_burn_undercurrent"
  | "approval_seeking"
  | "banter_avoidance"
  | "aesthetic_projection"
  | "novelty_instability"
  | "partnership_low_desire";

export type PatternFlagInput = {
  motiveScores: Record<MotiveKey, number>;
  lenses: Record<LensKey, number>;
  attachment: AttachmentScore | null;
};

type PatternFlagRule = {
  id: PatternFlagId;
  /** The report's own description of the trigger, for traceability. */
  reportTrigger: string;
  copy: string;
  evaluate: (input: PatternFlagInput) => boolean;
};

const RULES: PatternFlagRule[] = [
  {
    id: "ambiguity_amplification",
    reportTrigger: "high intrigue + high reassurance sensitivity",
    copy: "Hot-and-cold attention may have occupied more mental space than steady interest.",
    evaluate: ({ motiveScores, attachment }) =>
      motiveScores.intrigueSelectiveAccess >= HIGH && (attachment?.label === "reassuranceSensitive" || attachment?.label === "pushPull"),
  },
  {
    id: "caretaking_imbalance",
    reportTrigger: "high safety (warmth) + low reciprocity - reads as low boundaries/one-sided caretaking",
    copy: "You may have become the emotional manager of relationships that felt unequal.",
    evaluate: ({ motiveScores }) => motiveScores.warmthResponsiveness >= HIGH && motiveScores.reliabilityReciprocity <= LOW,
  },
  {
    id: "fast_burn_undercurrent",
    reportTrigger: "high vitality + fast burn + low consistency threshold (low reciprocity)",
    copy: "Your best beginnings may have outperformed their follow-through.",
    evaluate: ({ motiveScores, lenses }) =>
      motiveScores.socialVitality >= HIGH && lenses.fastSlow >= HIGH && motiveScores.reliabilityReciprocity <= LOW,
  },
  {
    id: "approval_seeking",
    reportTrigger: "high agency + high approval sensitivity (admiration-leaning)",
    copy: "Being chosen by an impressive person may sometimes feel like proof of your own value.",
    evaluate: ({ motiveScores, lenses }) => motiveScores.agencyDirection >= HIGH && lenses.admirationMutuality >= HIGH,
  },
  {
    id: "banter_avoidance",
    reportTrigger: "high mental attunement + space protection (attachment avoidance)",
    copy: "Banter may have made closeness possible while also helping you avoid direct vulnerability.",
    evaluate: ({ motiveScores, attachment }) =>
      motiveScores.cognitivePlay >= HIGH && (attachment?.label === "spaceProtective" || (attachment?.avoidance ?? 0) >= HIGH),
  },
  {
    id: "aesthetic_projection",
    reportTrigger: "high aesthetics + high projection (intrigue-leaning)",
    copy: "You may complete incomplete people with your imagination.",
    evaluate: ({ motiveScores, lenses }) => motiveScores.intrigueSelectiveAccess >= HIGH && lenses.directnessIntrigue >= HIGH,
  },
  {
    id: "novelty_instability",
    reportTrigger: "high novelty + low routine tolerance (exploration-leaning)",
    copy: "Familiarity may register as fading chemistry before the relationship has learned renewal.",
    evaluate: ({ motiveScores, lenses }) => motiveScores.noveltyAutonomy >= HIGH && lenses.explorationCommitment >= HIGH,
  },
  {
    id: "partnership_low_desire",
    reportTrigger: "high partnership (reliability) + low expressed desire (low vitality)",
    copy: "You may build relationships that function well but need more deliberate erotic and playful energy.",
    evaluate: ({ motiveScores }) => motiveScores.reliabilityReciprocity >= HIGH && motiveScores.socialVitality <= LOW,
  },
];

export type TriggeredPatternFlag = {
  id: PatternFlagId;
  copy: string;
};

export function evaluatePatternFlags(input: PatternFlagInput): TriggeredPatternFlag[] {
  return RULES.filter((rule) => rule.evaluate(input)).map((rule) => ({ id: rule.id, copy: rule.copy }));
}

export function patternFlagIds(): PatternFlagId[] {
  return RULES.map((rule) => rule.id);
}

/** Every rule's copy, keyed by id - independent of whether its conditions ever converge in a
 *  given input, so tests (and any future admin tooling) can inspect all eight without having
 *  to hand-craft a fixture that satisfies mutually exclusive rules simultaneously. */
export function allPatternFlagCopy(): TriggeredPatternFlag[] {
  return RULES.map((rule) => ({ id: rule.id, copy: rule.copy }));
}
