import "server-only";

// server-only. Maps each option id from lib/spec-test/items/spec-v2.ts to the scoring
// dimension it loads on. This is the file the report's own instructions say must never
// reach the browser (docs/spec-test-research.md §5: "The user does not need to know what
// every individual answer measures... The scoring can be hidden"). Every optionId here must
// have a matching option in the item bank - enforced by __tests__/lib/spec-test/loadings.test.ts.
//
// The report's prototype item bank (§5) gives each option exactly one bracketed motive/facet
// code and no secondary weights - so this MVP scores every option at lambda=1 on its single
// primary dimension (report §6.1: "1 for an option's primary motive... in the simplest MVP").
// Secondary weights are explicitly deferred to expert review per the report and are not
// invented here - see docs/spec-test-v2-implementation-plan.md §6's centroid-authoring note.

import type { ScoringDimensionKey } from "@/lib/spec-test/taxonomy";

/** optionId -> the single scoring dimension it loads on, for the 20 core (non-attachment)
 *  items. Comments trace each row back to the bracketed code in docs/spec-test-research.md §5. */
export const OPTION_MOTIVE_LOADINGS: Record<string, ScoringDimensionKey> = {
  // crowded-event [I-depth, V, A, I-aesthetic]
  "crowded-event-a": "containedDepthPrivacy",
  "crowded-event-b": "socialVitality",
  "crowded-event-c": "agencyDirection",
  "crowded-event-d": "aestheticSelectivity",

  // first-date-danger [W, C, N, R]
  "first-date-danger-a": "warmthResponsiveness",
  "first-date-danger-b": "cognitivePlay",
  "first-date-danger-c": "noveltyAutonomy",
  "first-date-danger-d": "reliabilityReciprocity",

  // message-replay [I-depth, W, C, V]
  "message-replay-a": "containedDepthPrivacy",
  "message-replay-b": "warmthResponsiveness",
  "message-replay-c": "cognitivePlay",
  "message-replay-d": "socialVitality",

  // profile-investigate [A, I-aesthetic, N, R]
  "profile-investigate-a": "agencyDirection",
  "profile-investigate-b": "aestheticSelectivity",
  "profile-investigate-c": "noveltyAutonomy",
  "profile-investigate-d": "reliabilityReciprocity",

  // compliment-deepest [V, A, C, W]
  "compliment-deepest-a": "socialVitality",
  "compliment-deepest-b": "agencyDirection",
  "compliment-deepest-c": "cognitivePlay",
  "compliment-deepest-d": "warmthResponsiveness",

  // conversation-pause [I-depth, I-aesthetic, R, N]
  "conversation-pause-a": "containedDepthPrivacy",
  "conversation-pause-b": "aestheticSelectivity",
  "conversation-pause-c": "reliabilityReciprocity",
  "conversation-pause-d": "noveltyAutonomy",

  // hosting-party [W, V, A, C]
  "hosting-party-a": "warmthResponsiveness",
  "hosting-party-b": "socialVitality",
  "hosting-party-c": "agencyDirection",
  "hosting-party-d": "cognitivePlay",

  // slow-reveal [I-depth, I-aesthetic, N, R]
  "slow-reveal-a": "containedDepthPrivacy",
  "slow-reveal-b": "aestheticSelectivity",
  "slow-reveal-c": "noveltyAutonomy",
  "slow-reveal-d": "reliabilityReciprocity",

  // disagreement-response [W, A, C, R]
  "disagreement-response-a": "warmthResponsiveness",
  "disagreement-response-b": "agencyDirection",
  "disagreement-response-c": "cognitivePlay",
  "disagreement-response-d": "reliabilityReciprocity",

  // plans-cancelled [V, I-aesthetic, N, I-depth]
  "plans-cancelled-a": "socialVitality",
  "plans-cancelled-b": "aestheticSelectivity",
  "plans-cancelled-c": "noveltyAutonomy",
  "plans-cancelled-d": "containedDepthPrivacy",

  // feel-chosen [W, A, R, I-aesthetic]
  "feel-chosen-a": "warmthResponsiveness",
  "feel-chosen-b": "agencyDirection",
  "feel-chosen-c": "reliabilityReciprocity",
  "feel-chosen-d": "aestheticSelectivity",

  // routine-desire [V, C, N, I-depth]
  "routine-desire-a": "socialVitality",
  "routine-desire-b": "cognitivePlay",
  "routine-desire-c": "noveltyAutonomy",
  "routine-desire-d": "containedDepthPrivacy",

  // friend-introduction [R, W, A, C]
  "friend-introduction-a": "reliabilityReciprocity",
  "friend-introduction-b": "warmthResponsiveness",
  "friend-introduction-c": "agencyDirection",
  "friend-introduction-d": "cognitivePlay",

  // strongest-entrance [I-aesthetic, I-depth, V, N]
  "strongest-entrance-a": "aestheticSelectivity",
  "strongest-entrance-b": "containedDepthPrivacy",
  "strongest-entrance-c": "socialVitality",
  "strongest-entrance-d": "noveltyAutonomy",

  // intimate-vulnerability [W, C, R, I-depth]
  "intimate-vulnerability-a": "warmthResponsiveness",
  "intimate-vulnerability-b": "cognitivePlay",
  "intimate-vulnerability-c": "reliabilityReciprocity",
  "intimate-vulnerability-d": "containedDepthPrivacy",

  // attractive-life [A, V, I-aesthetic, N]
  "attractive-life-a": "agencyDirection",
  "attractive-life-b": "socialVitality",
  "attractive-life-c": "aestheticSelectivity",
  "attractive-life-d": "noveltyAutonomy",

  // forgivable-flaw [I-depth, V, C, I-aesthetic]
  "forgivable-flaw-a": "containedDepthPrivacy",
  "forgivable-flaw-b": "socialVitality",
  "forgivable-flaw-c": "cognitivePlay",
  "forgivable-flaw-d": "aestheticSelectivity",

  // lasting-partnership [W, A, N, R]
  "lasting-partnership-a": "warmthResponsiveness",
  "lasting-partnership-b": "agencyDirection",
  "lasting-partnership-c": "noveltyAutonomy",
  "lasting-partnership-d": "reliabilityReciprocity",

  // chemistry-definition [I-depth, V, C, I-aesthetic]
  "chemistry-definition-a": "containedDepthPrivacy",
  "chemistry-definition-b": "socialVitality",
  "chemistry-definition-c": "cognitivePlay",
  "chemistry-definition-d": "aestheticSelectivity",

  // repeated-sunday [W, A, N, R]
  "repeated-sunday-a": "warmthResponsiveness",
  "repeated-sunday-b": "agencyDirection",
  "repeated-sunday-c": "noveltyAutonomy",
  "repeated-sunday-d": "reliabilityReciprocity",
};

/**
 * Two item pairs written so that a purely status/appearance-driven answer on one contradicts
 * a purely depth/connection-driven answer on the other, satisfying the report's "include at
 * least two reverse or tension items that distinguish attraction from judgment" (§5). Used by
 * lib/spec-test/scoring/quality.ts to flag a response that swings to the opposite extreme on
 * paired items as a possible low-signal contradiction rather than genuine ambivalence.
 */
export const TENSION_ITEM_PAIRS: [string, string][] = [
  ["compliment-deepest", "friend-introduction"],
  ["attractive-life", "lasting-partnership"],
];

/** anxiety/avoidance deltas in [-1, 1] for the four attachment-scenario items (see
 *  lib/spec-test/items/spec-v2.ts). Not derived from any published inventory - original
 *  scenario writing informed by the two-dimensional model in docs/spec-test-research.md §2.2. */
export type AttachmentDelta = { anxiety: number; avoidance: number };

export const OPTION_ATTACHMENT_LOADINGS: Record<string, AttachmentDelta> = {
  "delayed-reply-a": { anxiety: 1, avoidance: 0 },
  "delayed-reply-b": { anxiety: -1, avoidance: -1 },
  "delayed-reply-c": { anxiety: -0.2, avoidance: 1 },
  "delayed-reply-d": { anxiety: 0.5, avoidance: 0.5 },

  "fast-closeness-a": { anxiety: 1, avoidance: -0.3 },
  "fast-closeness-b": { anxiety: -1, avoidance: -1 },
  "fast-closeness-c": { anxiety: -0.3, avoidance: 1 },
  "fast-closeness-d": { anxiety: 0.5, avoidance: 0.4 },

  "conflict-response-a": { anxiety: -1, avoidance: -1 },
  "conflict-response-b": { anxiety: 1, avoidance: -0.2 },
  "conflict-response-c": { anxiety: -0.2, avoidance: 1 },
  "conflict-response-d": { anxiety: 0.5, avoidance: 0.5 },

  "need-comfort-a": { anxiety: -1, avoidance: -1 },
  "need-comfort-b": { anxiety: 1, avoidance: -0.2 },
  "need-comfort-c": { anxiety: -0.2, avoidance: 1 },
  "need-comfort-d": { anxiety: 0.5, avoidance: 0.5 },
};

export const ATTACHMENT_ITEM_IDS = ["delayed-reply", "fast-closeness", "conflict-response", "need-comfort"];
