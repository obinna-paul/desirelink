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
    "You're pulled toward tenderness. A {person} who reassures you without needing to be asked twice, who notices you've gone quiet and actually checks in instead of waiting for you to explain yourself. It's less about grand romantic gestures and more about feeling met in the small moments, instead of feeling handled or managed like a task on someone's list.",
  reliabilityReciprocity:
    "You're pulled toward follow-through. A {person} who actually does what {they} said {they} would, who treats you the same on a quiet Tuesday at home as on a good night out with friends watching, and who isn't secretly keeping score of who did what last. Consistency reads to you as care, maybe even more than any single grand gesture would.",
  socialVitality:
    "You're pulled toward energy. Boldness, flirtation, a {person} who brings an entire room, or even just a two-person conversation, to life simply by fully showing up in it. It's the difference between someone who's technically present and someone whose presence you can actually feel.",
  agencyDirection:
    "You're pulled toward direction. Ambition, competence, the unmistakable sense that a {person} chose {their} life on purpose instead of just drifting into whatever happened next. Watching someone build something real, on purpose, does more for your attraction than watching someone simply have a good time.",
  cognitivePlay:
    "You're pulled toward wit. Quick minds, real curiosity, a conversation that feels like a game you're both actually trying to win instead of small talk you're both just enduring. A {person} who can keep pace with your thinking gets further with you than one who simply agrees with everything you say.",
  noveltyAutonomy:
    "You're pulled toward possibility. Spontaneity, self-expression, a {person} who makes your life feel bigger and more open instead of more scheduled and boxed in. The appeal isn't chaos for its own sake, it's the sense that there's always another door somewhere worth trying.",
  intrigueSelectiveAccess:
    "You're pulled toward restraint. Privacy, style, a slow reveal that makes attention feel earned rather than handed out to whoever happened to ask first. A {person} who doesn't tell {their} whole story on the first date makes you lean in, not lose interest.",
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
      copy: "Here's one you might not have clocked about yourself. You're not actually chasing fireworks, whatever your friends might assume about your type. What genuinely gets you is knowing exactly where you stand with someone, no guessing, no reading into a delayed text. Predictable isn't boring to you the way it might be for other people. It's kind of the whole appeal, because certainty is what lets you actually relax into something.",
      partnerNote: "Your best match is a {person} steady enough that you never have to wonder where you stand.",
    },
    high: {
      title: "You run on spark, not certainty",
      copy: "You might genuinely believe you want stability more than you actually do, right up until a sure thing starts to feel a little flat. What actually lights you up is momentum, that small jolt of not knowing exactly what happens next with someone. A guarantee is nice on paper. In practice, a spark beats it almost every time, even when you know better.",
      partnerNote: "Your best match is a {person} who keeps a little unpredictability alive, even years in.",
    },
  },
  closenessAutonomy: {
    low: {
      title: "You want in, not just nearby",
      copy: "You might describe yourself as independent, and you're not wrong about that. But your answers say something else is also true underneath it: you genuinely want real closeness, not just someone pleasant nearby who's technically your partner. There's nothing needy about wanting to be wanted that much, whatever anyone's told you before.",
      partnerNote: "Your best match is a {person} who wants to be close as often as you do.",
    },
    high: {
      title: "You need your own room, even in love",
      copy: "You might not notice this about yourself day to day, especially if the relationship is going well, but you protect your independence hard, even inside a relationship you genuinely want and chose. That's not commitment issues in disguise. It's just how you stay recognizably yourself instead of dissolving into someone else's life.",
      partnerNote: "Your best match is a {person} who respects your need for space without taking it personally.",
    },
  },
  fastSlow: {
    low: {
      title: "You're a slow burn, whether you admit it or not",
      copy: "You might think of yourself as someone who jumps in fast, especially if a recent crush felt intense right away. Your answers tell a quieter story underneath that. You actually build real attraction slowly and on purpose, testing as you go, even on the nights it feels like everything's moving quick.",
      partnerNote: "Your best match is a {person} who lets things build instead of rushing the pace.",
    },
    high: {
      title: "You catch feelings at full speed",
      copy: "You might tell people, maybe even yourself, that you take things slow and never rush into anything. Your answers quietly disagree. You fall fast when something's right, sometimes faster than you'd admit out loud, and you're not actually that interested in performing more caution than you feel.",
      partnerNote: "Your best match is a {person} who can keep up when you fall fast, instead of pumping the brakes.",
    },
  },
  directnessIntrigue: {
    low: {
      title: "You want it said out loud",
      copy: "Mystery sounds fun in theory, the kind of thing people say they like in a dating profile. Your answers reveal you actually want things spelled out in plain language. Clear beats cryptic for you every single time, even if admitting that out loud on a first date feels a little unglamorous.",
      partnerNote: "Your best match is a {person} who just tells you the thing, instead of making you decode it.",
    },
    high: {
      title: "You're wired for a little mystery",
      copy: "You might say, with total sincerity, that you want someone completely straightforward and easy to read. Your answers quietly disagree. A little bit of mystery, something left for you to figure out on your own, is doing more work on your actual attraction than you'd probably guess if you thought about it directly.",
      partnerNote: "Your best match is a {person} who keeps a little something back on purpose, instead of laying it all out on date one.",
    },
  },
  privatePublic: {
    low: {
      title: "Your love language is private, not public",
      copy: "You're not that into showing a relationship off, and that's not coldness, it's just not where the good feeling lives for you. What actually feels good is quiet intimacy, the kind that happens with the door closed and nobody else watching. Public affection is nice enough. This is nicer, every time.",
      partnerNote: "Your best match is happy keeping the good stuff between just the two of you.",
    },
    high: {
      title: "You want the world to know",
      copy: "You might not say this part out loud, since it can sound a little vain, but you genuinely like affection other people can actually see. A hand held in public, someone visibly proud to be with you in front of others. Being visibly chosen matters more to you than you'd probably guess.",
      partnerNote: "Your best match is a {person} who isn't shy about showing you off.",
    },
  },
  admirationMutuality: {
    low: {
      title: "You want a teammate, not an idol",
      copy: "You might genuinely think you're drawn to impressive, accomplished people, and on the surface that can look true. What your answers actually show underneath it is that you want to feel like an equal standing side by side with someone, not looking up at {them} from below like a fan.",
      partnerNote: "Your best match is a {person} who treats you like an equal, not a project or a prize.",
    },
    high: {
      title: "A little bit of awe goes a long way for you",
      copy: "You might not admit this readily, since it can feel like it undercuts the whole equal-partnership ideal, but genuinely looking up to someone, being a little in awe of what {they}'ve built or how {they} carry {themself}, quietly does more for your attraction than pure equality ever does.",
      partnerNote: "Your best match is a {person} who gives you something real to look up to, not just someone comfortable.",
    },
  },
  mindEmbodied: {
    low: {
      title: "Presence gets you more than words do",
      copy: "You might think you're all about the conversation, the wit, the back-and-forth. Actually, energy and presence, the way someone carries {themself} into a room before a single word gets said, is pulling more weight for you than clever talk ever could on its own.",
      partnerNote: "Your best match is a {person} who brings real presence, not just good conversation.",
    },
    high: {
      title: "You fall for minds first",
      copy: "Looks and energy are fine, and you'll notice them, but your answers reveal the real move for you is mental. Someone who can actually keep pace with how your brain works, who challenges a thought instead of just nodding along, gets further with you than someone who just shows up looking good and says little.",
      partnerNote: "Your best match is a {person} who can actually keep up with how your brain works.",
    },
  },
  explorationCommitment: {
    low: {
      title: "You're commitment first, even if you don't lead with it",
      copy: "You might play it casual out loud, especially early on, using words like \"seeing where it goes.\" Your answers say something more committed underneath that. You're actually looking for something that goes somewhere real, not just something that happens once, feels good, and evaporates by the weekend.",
      partnerNote: "Your best match is a {person} looking for something real, not just something happening.",
    },
    high: {
      title: "You're wired to keep discovering, not settle in early",
      copy: "You might feel a little guilty reading this one, like it means something's wrong with you. It doesn't. You're genuinely drawn to discovery over certainty right now, more interested in finding out what's next than locking anything down early, and that's not a flaw to fix. It's just an honest read of where you are.",
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
