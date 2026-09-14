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
// Copy strings started as near-verbatim quotes from the report's §7 table, then went through
// two follow-up passes: first for voice (sound like an actual observation instead of a
// clinical note), then for depth (direct feedback that a single sentence per pattern read as
// shallow next to 24 answers' worth of signal). Every line is now a short paragraph - a
// concrete scenario, then the mechanism behind it - while keeping the report's own required
// hedge ("may have", "may sometimes") in every line, since eligibility here is still just a
// converged-answers signal, not a diagnosis.

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
    copy: "Hot-and-cold energy may have lived rent-free in your head more than actual steady interest ever did. The one who texts back in two minutes one day and two days the next probably got more of your attention than the one who was reliably, boringly into you. That's not you being dramatic. Uncertainty genuinely produces more mental replay than certainty does, which is exactly why it can feel like chemistry when it's really just static.",
    evaluate: ({ motiveScores, attachment }) =>
      motiveScores.intrigueSelectiveAccess >= HIGH && (attachment?.label === "reassuranceSensitive" || attachment?.label === "pushPull"),
  },
  {
    id: "caretaking_imbalance",
    reportTrigger: "high safety (warmth) + low reciprocity - reads as low boundaries/one-sided caretaking",
    copy: "You may have ended up managing the emotional temperature of relationships that weren't equal to begin with. Checking in first, smoothing things over, remembering the important dates while yours slipped by unnoticed. Somewhere along the way, being the reliable one turned into being the only one doing the work. Warmth is a strength. It stops being one the moment it's the only thing holding the relationship together.",
    evaluate: ({ motiveScores }) => motiveScores.warmthResponsiveness >= HIGH && motiveScores.reliabilityReciprocity <= LOW,
  },
  {
    id: "fast_burn_undercurrent",
    reportTrigger: "high vitality + fast burn + low consistency threshold (low reciprocity)",
    copy: "The opening chapter may have been better written than everything {they} did after it. Incredible first few weeks: the texting, the plans, the feeling that you'd found something rare. Then the follow-through never quite matched the opening. If your relationships tend to have a great pilot episode and a disappointing season, the pattern probably isn't bad luck. It's a preference for the chase you haven't fully clocked yet.",
    evaluate: ({ motiveScores, lenses }) =>
      motiveScores.socialVitality >= HIGH && lenses.fastSlow >= HIGH && motiveScores.reliabilityReciprocity <= LOW,
  },
  {
    id: "approval_seeking",
    reportTrigger: "high agency + high approval sensitivity (admiration-leaning)",
    copy: "Being picked by an impressive {person} may sometimes feel like proof of your own worth, more than it should. Landing someone accomplished, admired, hard to get, and suddenly feeling like you've leveled up as a person, not just found a good partner. That's worth noticing, because it means your own self-worth can end up depending on who wants you back, instead of standing on its own regardless of who's interested.",
    evaluate: ({ motiveScores, lenses }) => motiveScores.agencyDirection >= HIGH && lenses.admirationMutuality >= HIGH,
  },
  {
    id: "banter_avoidance",
    reportTrigger: "high mental attunement + space protection (attachment avoidance)",
    copy: "Banter may have been how you got close to people, and also how you avoided ever being direct about what you actually feel. Keeping things clever and light is a genuinely good way to build intimacy fast. It's also a very effective way to never actually say the vulnerable thing out loud. If you can name the exact moment things usually get \"too serious\" and change the subject, that's this pattern showing up in real time.",
    evaluate: ({ motiveScores, attachment }) =>
      motiveScores.cognitivePlay >= HIGH && (attachment?.label === "spaceProtective" || (attachment?.avoidance ?? 0) >= HIGH),
  },
  {
    id: "aesthetic_projection",
    reportTrigger: "high aesthetics + high projection (intrigue-leaning)",
    copy: "You may fill in the blanks on incomplete {people} with your imagination, and fall for the version you invented. A striking look, a few good photos, an air of mystery, and suddenly there's a whole personality assembled in your head that the actual person hasn't confirmed yet. The letdown, when it comes, usually isn't about them changing. It's about meeting the real person after you'd already fallen for the one you built.",
    evaluate: ({ motiveScores, lenses }) => motiveScores.intrigueSelectiveAccess >= HIGH && lenses.directnessIntrigue >= HIGH,
  },
  {
    id: "novelty_instability",
    reportTrigger: "high novelty + low routine tolerance (exploration-leaning)",
    copy: "Getting familiar with someone may start to feel like the chemistry is dying, before the relationship's even had a chance to find a second gear. The mystery wears off, the routine sets in, and something in you starts quietly checking out, even when nothing has actually gone wrong. Familiarity isn't actually the enemy here. It's just unfamiliar to you, since you haven't had many relationships stick around long enough to find out what comes after the new-relationship high.",
    evaluate: ({ motiveScores, lenses }) => motiveScores.noveltyAutonomy >= HIGH && lenses.explorationCommitment >= HIGH,
  },
  {
    id: "partnership_low_desire",
    reportTrigger: "high partnership (reliability) + low expressed desire (low vitality)",
    copy: "You may build relationships that run smoothly on paper but are quietly starved for playfulness and heat. Great communication, fair division of everything, zero drama, and somewhere in all that stability the actual desire got deprioritized. Reliable and passionate aren't mutually exclusive. It's just easy to let one crowd out the other when stability is what you're naturally best at building.",
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
