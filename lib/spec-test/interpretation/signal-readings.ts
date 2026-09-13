import "server-only";

// server-only. Two new result modules (added after direct user feedback: 24 answers were
// producing a result that felt shallow - one archetype template and a couple of one-line
// flags, with none of the taker's actual multi-dimensional score ever shown). Both modules
// read directly off scores that were already being computed and stored - lib/spec-test/
// scoring/score.ts's motiveScores and attachment - and had simply never been surfaced as
// their own content. See compose.ts for how these get selected per result.
//
// Attachment copy follows the report's own safety boundary (docs/spec-test-research.md §9):
// "never interpret ... as a diagnosis," ordinary language only, and only ever one of the four
// ATTACHMENT_RESPONSE_LABELS from taxonomy.ts - never a clinical attachment-theory term.

import type { AttachmentResponseLabel, MotiveKey } from "@/lib/spec-test/taxonomy";

/**
 * One line per motive (report §3 Layer A's own "high-score signal" column, re-expressed in
 * second person) - shown only for whichever 2-3 motives scored highest for a given taker
 * (see compose.ts's topMotiveSignals), so it reads as "here's specifically what's pulling
 * you," not a rundown of all seven.
 */
export const MOTIVE_READINGS: Record<MotiveKey, string> = {
  warmthResponsiveness:
    "You're pulled toward tenderness - someone emotionally present, who reassures without being asked twice, who makes you feel met instead of managed.",
  reliabilityReciprocity:
    "You're pulled toward follow-through - a {person} who does what {they} said, treats you the same on a quiet Tuesday as on a good night out, and isn't keeping score.",
  socialVitality:
    "You're pulled toward energy - boldness, flirtation, a {person} who brings a room (or just a conversation) to life by fully showing up in it.",
  agencyDirection:
    "You're pulled toward direction - ambition, competence, the sense that a {person} chose {their} life on purpose instead of drifting into it.",
  cognitivePlay: "You're pulled toward wit - quick minds, curiosity, a conversation that feels like a game you're both actually trying to win.",
  noveltyAutonomy:
    "You're pulled toward possibility - spontaneity, self-expression, a {person} who makes life feel bigger instead of more scheduled.",
  intrigueSelectiveAccess:
    "You're pulled toward restraint - privacy, style, a slow reveal that makes attention feel earned instead of handed to just anyone.",
};

export type AttachmentReading = { title: string; copy: string };

export const ATTACHMENT_READINGS: Record<AttachmentResponseLabel, AttachmentReading> = {
  steadyUnderUncertainty: {
    title: "Steady Under Uncertainty",
    copy: "When things get a little unclear - a slow reply, a change of plans, mixed signals - you don't spiral and you don't shut down. You can sit inside \"I don't know yet\" without it wrecking your week, and that steadiness is a big reason people feel safe around you. Just don't let your own calm double as permission to ignore an actual red flag - steady isn't the same as unbothered by everything.",
  },
  reassuranceSensitive: {
    title: "Reassurance-Sensitive",
    copy: "Silence can feel loud to you. A slow reply or a vague plan doesn't just sit there - it gets a full investigation in your head. You're not \"too much\" for wanting to know where you stand; you just do best with a {person} who actually communicates, instead of one who leaves you refreshing your phone. The fix isn't wanting less reassurance - it's choosing people who give it freely, before you have to ask twice.",
  },
  spaceProtective: {
    title: "Space-Protective",
    copy: "You need room to breathe, and closing that gap too fast makes you want to open a different one. That's not coldness - it's how you stay yourself while still choosing to be with someone. The catch: from the outside, needing space can look exactly like losing interest. A {person} worth keeping is one who can tell the difference and doesn't take your need for room personally.",
  },
  pushPull: {
    title: "Push-Pull",
    copy: "You want closeness and you want distance, sometimes in the same week - not a contradiction in your character, just two real needs that haven't worked out a schedule yet. What actually works for you is a {person} who doesn't panic when you pull back and doesn't disappear when you lean in - someone steady enough to hold the rhythm instead of trying to match every swing of it.",
  },
};
