import "server-only";

// server-only. Result modules added after direct user feedback in two rounds: first, that 24
// answers were producing a result that felt shallow (one archetype template and a couple of
// one-line flags, with none of the taker's actual multi-dimensional score ever shown);
// second, that the result should say things the taker didn't already know about themselves
// rather than reflecting answers back at them. All three modules here read directly off
// scores lib/spec-test/scoring/score.ts was already computing and storing - motiveScores,
// lenses, attachment - and had simply never been surfaced as their own content. See
// compose.ts for how each gets selected per result.
//
// Attachment copy follows the report's own safety boundary (docs/spec-test-research.md §9):
// "never interpret ... as a diagnosis," ordinary language only, and only ever one of the four
// ATTACHMENT_RESPONSE_LABELS from taxonomy.ts - never a clinical attachment-theory term.

import type { AttachmentResponseLabel, LensKey, MotiveKey } from "@/lib/spec-test/taxonomy";

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

export type LensPoleReading = {
  title: string;
  /** The "you might not have clocked this about yourself" reveal - report §3 Layer B's own
   *  definition of the lens, re-expressed as a specific, surprising observation rather than a
   *  restatement of "you answered X." A lens score is a pattern extracted across several
   *  items, not something a taker consciously chose, so this is genuinely new information to
   *  them - not a recap. */
  copy: string;
  /** report §7 "person to marry" section: "a behavioral partner brief," not a type label -
   *  what kind of partner actually complements this specific lean. Shown alongside the
   *  archetype's own longTermFit as a second, trait-based partner signal (the report's own
   *  recommendation to borrow LaHaye's narrative breadth - connecting a trait to concrete
   *  relationship guidance - without adopting his four-temperament system as a second scoring
   *  layer; see docs/spec-test-research.md §1's explicit "should not adopt the four
   *  temperaments as the scoring foundation"). */
  partnerNote: string;
};

/**
 * One reading per pole of each of the 8 interpretive lenses (report §3 Layer B) - shown only
 * for the taker's single most extreme lens (see compose.ts's topLensInsight), the one furthest
 * from the neutral midpoint and therefore the most genuinely distinctive thing about how they
 * experience their own archetype.
 */
export const LENS_INSIGHTS: Record<LensKey, { low: LensPoleReading; high: LensPoleReading }> = {
  sparkSafety: {
    low: {
      title: "You run on calm, not chaos",
      copy: "Here's one you might not have clocked about yourself. You're not actually chasing fireworks. What gets you is knowing exactly where you stand. Predictable isn't boring to you. It's kind of the whole appeal.",
      partnerNote: "Your best match is a {person} steady enough that you never have to wonder where you stand.",
    },
    high: {
      title: "You run on spark, not certainty",
      copy: "You might think you want stability more than you actually do. What lights you up is momentum, that little jolt of not knowing exactly what happens next. A guarantee is nice. A spark beats it every time.",
      partnerNote: "Your best match is a {person} who keeps a little unpredictability alive, even years in.",
    },
  },
  closenessAutonomy: {
    low: {
      title: "You want in, not just nearby",
      copy: "You might call yourself independent, and you're not wrong, but your answers say you genuinely want real closeness, not just someone in the vicinity. There's nothing wrong with wanting to be wanted that much.",
      partnerNote: "Your best match is a {person} who wants to be close as often as you do.",
    },
    high: {
      title: "You need your own room, even in love",
      copy: "You might not notice this about yourself day to day, but you protect your independence hard, even inside a relationship you actually want. That's not commitment issues. That's just how you stay yourself.",
      partnerNote: "Your best match is a {person} who respects your need for space without taking it personally.",
    },
  },
  fastSlow: {
    low: {
      title: "You're a slow burn, whether you admit it or not",
      copy: "You might think of yourself as someone who jumps in fast. Your answers tell a different story. You actually build attraction slowly and on purpose, even on the nights it feels like you're moving quick.",
      partnerNote: "Your best match is a {person} who lets things build instead of rushing the pace.",
    },
    high: {
      title: "You catch feelings at full speed",
      copy: "You might tell people you take things slow. Your answers disagree. You fall fast when it's right, and you're not actually that interested in pretending otherwise.",
      partnerNote: "Your best match is a {person} who can keep up when you fall fast, instead of pumping the brakes.",
    },
  },
  directnessIntrigue: {
    low: {
      title: "You want it said out loud",
      copy: "Mystery sounds fun in theory. Your answers reveal you actually want things spelled out. Clear beats cryptic for you, every single time, even if you'd never admit that out loud on a date.",
      partnerNote: "Your best match is a {person} who just tells you the thing, instead of making you decode it.",
    },
    high: {
      title: "You're wired for a little mystery",
      copy: "You might say you want someone completely straightforward. Your answers disagree. A little bit of mystery, something left to figure out, is doing more work on your attraction than you probably realize.",
      partnerNote: "Your best match is a {person} who keeps a little something back on purpose, instead of laying it all out on date one.",
    },
  },
  privatePublic: {
    low: {
      title: "Your love language is private, not public",
      copy: "You're not that into showing it off. What actually feels good to you is quiet intimacy, the kind nobody else gets to see. Public affection is nice. This is nicer.",
      partnerNote: "Your best match is happy keeping the good stuff between just the two of you.",
    },
    high: {
      title: "You want the world to know",
      copy: "You might not say this part out loud, but you genuinely like affection other people can see. Being visibly chosen matters more to you than you'd probably guess.",
      partnerNote: "Your best match is a {person} who isn't shy about showing you off.",
    },
  },
  admirationMutuality: {
    low: {
      title: "You want a teammate, not an idol",
      copy: "You might think you're drawn to impressive people. What your answers actually show is that you want to feel like an equal, side by side, not looking up at someone from below.",
      partnerNote: "Your best match is a {person} who treats you like an equal, not a project or a prize.",
    },
    high: {
      title: "A little bit of awe goes a long way for you",
      copy: "You might not admit this readily, but genuinely looking up to someone, being a little in awe of {them}, quietly does more for your attraction than pure equality ever does.",
      partnerNote: "Your best match is a {person} who gives you something real to look up to, not just someone comfortable.",
    },
  },
  mindEmbodied: {
    low: {
      title: "Presence gets you more than words do",
      copy: "You might think you're all about the conversation. Actually, energy and presence, how someone carries themselves in a room, is pulling more weight for you than clever talk ever could.",
      partnerNote: "Your best match is a {person} who brings real presence, not just good conversation.",
    },
    high: {
      title: "You fall for minds first",
      copy: "Looks and energy are fine, but your answers reveal the real move is mental. Someone who can actually keep up with your brain gets further with you than someone who just shows up looking good.",
      partnerNote: "Your best match is a {person} who can actually keep up with how your brain works.",
    },
  },
  explorationCommitment: {
    low: {
      title: "You're commitment first, even if you don't lead with it",
      copy: "You might play it casual out loud. Your answers say you're actually looking for something that goes somewhere, not just something that happens once and evaporates.",
      partnerNote: "Your best match is a {person} looking for something real, not just something happening.",
    },
    high: {
      title: "You're wired to keep discovering, not settle in early",
      copy: "You might feel a little guilty about this one. You're genuinely drawn to discovery over certainty right now, and that's not something to fix. It's just where you are.",
      partnerNote: "Your best match is a {person} who doesn't rush you into certainty before you're ready for it.",
    },
  },
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
