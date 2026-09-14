import "server-only";

// server-only. Assembles a full result reading from scored v2 data, per the report §7
// "Result composition" table. Takes a narrow input shape rather than the full
// SpecTestDecision union from scoring/decide.ts: a low-signal decision simply cannot supply
// a primarySpec, so "never composes a reading for a low-signal result" (plan §9's acceptance
// criteria) is a type-level guarantee here rather than a runtime branch - and it lets this
// module compose a reading equally well from a value just computed by decideSpecTestResult
// or from one already read back out of the database (see lib/spec-test/results.ts).

import { ARCHETYPE_READINGS_V2 } from "@/lib/spec-test/interpretation/readings-v2";
import { evaluatePatternFlags, type TriggeredPatternFlag } from "@/lib/spec-test/interpretation/pattern-flags";
import { ATTACHMENT_READINGS, LENS_INSIGHTS, MOTIVE_READINGS } from "@/lib/spec-test/interpretation/signal-readings";
import type { AttachmentScore } from "@/lib/spec-test/scoring/score";
import {
  LENS_KEYS,
  MOTIVE_KEYS,
  MOTIVE_LABELS,
  type ArchetypeKey,
  type AttachmentResponseLabel,
  type LensKey,
  type MotiveKey,
  type ResultConfidence,
} from "@/lib/spec-test/taxonomy";

const CONFIDENCE_COPY: Record<Exclude<ResultConfidence, "low_signal">, string> = {
  clear: "Strong match",
  blend: "A close blend of two specs",
  split: "Your spark and your staying power point in different places",
};

export type ComposeInput = {
  primarySpec: ArchetypeKey;
  secondarySpec: ArchetypeKey;
  confidence: Exclude<ResultConfidence, "low_signal">;
  motiveScores: Record<MotiveKey, number>;
  lenses: Record<LensKey, number>;
  attachment: AttachmentScore | null;
  sparkPrimarySpec: ArchetypeKey;
  partnershipPrimarySpec: ArchetypeKey;
};

export type TopMotiveSignal = { key: MotiveKey; label: string; copy: string };

export type AttachmentInsight = { label: AttachmentResponseLabel; title: string; copy: string };

export type LensInsight = { key: LensKey; pole: "low" | "high"; title: string; copy: string; partnerNote: string };

export type SpecTestResultCopy = {
  primarySpec: ArchetypeKey;
  secondarySpec: ArchetypeKey;
  headline: { name: string; tagline: string };
  /** report §7 "Secondary influence" module. */
  secondaryInfluence: string;
  /** report §7 "Core pull" module. */
  corePull: string;
  /** report §10 "Why this pulls you in: three specific attraction signals drawn from
   *  answers" - the taker's own three highest-scoring motives, not the fixed archetype copy
   *  above. Always exactly 3 (there are always 7 scored motives to rank), ties broken by
   *  MOTIVE_KEYS order for a deterministic result. */
  topMotives: TopMotiveSignal[];
  /** Something the taker likely hasn't consciously noticed about themselves: the single
   *  interpretive lens (report §3 Layer B) their answers lean hardest toward, in either
   *  direction. A lens score is extracted across several items rather than chosen directly,
   *  so this is new information, not a recap of an answer. Always present - all 8 lenses are
   *  scored for every usable result, unlike attachment below. */
  lensInsight: LensInsight;
  whatItSaysAboutYou: string;
  /** The taker's attachment-response read (report §3 Layer C) in ordinary language - null
   *  only when no attachment item was answered (see scoreAttachment). Never a diagnosis;
   *  always one of the four ATTACHMENT_RESPONSE_LABELS. */
  attachmentInsight: AttachmentInsight | null;
  /** report §7 "Dating loop" module - only the flags whose conditions actually converged. */
  datingLoop: TriggeredPatternFlag[];
  strength: string;
  blindSpot: string;
  /** report §7's behavioral "person to marry" brief for the primary archetype - a fixed
   *  per-archetype paragraph. lensInsight.partnerNote above is a second, trait-based partner
   *  signal shown alongside it, so the full partner brief a taker sees draws on more than one
   *  computed signal instead of only the archetype label. */
  longTermFit: string;
  growthPrompt: string;
  confidence: Exclude<ResultConfidence, "low_signal">;
  confidenceLabel: string;
  /** report §7/§10 "who pulls you in vs who works for you" - present only on a split result. */
  sparkPartnershipTwist: { sparkSpec: ArchetypeKey; sparkName: string; partnershipSpec: ArchetypeKey; partnershipName: string; copy: string } | null;
};

/** The taker's own top 3 motives by score, each paired with MOTIVE_READINGS' description -
 *  see the SpecTestResultCopy.topMotives doc comment for why this is separate from the fixed
 *  per-archetype coreReading. */
function topMotiveSignals(motiveScores: Record<MotiveKey, number>): TopMotiveSignal[] {
  return [...MOTIVE_KEYS]
    .sort((a, b) => motiveScores[b] - motiveScores[a])
    .slice(0, 3)
    .map((key) => ({ key, label: MOTIVE_LABELS[key], copy: MOTIVE_READINGS[key] }));
}

function attachmentInsight(attachment: AttachmentScore | null): AttachmentInsight | null {
  if (!attachment) return null;
  const reading = ATTACHMENT_READINGS[attachment.label];
  return { label: attachment.label, title: reading.title, copy: reading.copy };
}

/** The taker's single most extreme lens - furthest from the neutral 50 midpoint in either
 *  direction, ties broken by LENS_KEYS order for a deterministic result. See the
 *  SpecTestResultCopy.lensInsight doc comment for why only one is shown. */
function topLensInsight(lenses: Record<LensKey, number>): LensInsight {
  const topKey = [...LENS_KEYS].sort((a, b) => Math.abs(lenses[b] - 50) - Math.abs(lenses[a] - 50))[0];
  const pole: "low" | "high" = lenses[topKey] >= 50 ? "high" : "low";
  const reading = LENS_INSIGHTS[topKey][pole];
  return { key: topKey, pole, title: reading.title, copy: reading.copy, partnerNote: reading.partnerNote };
}

/** Folds a tagline into the middle of a sentence: drops the trailing period and lowercases
 *  the first letter, so "Dependable, values-driven..." can read as "..., dependable,
 *  values-driven..." instead of colliding with the surrounding sentence's own capitalization
 *  and punctuation. */
function inlineTagline(tagline: string): string {
  const stripped = tagline.endsWith(".") ? tagline.slice(0, -1) : tagline;
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}

export function composeSpecTestResult(input: ComposeInput): SpecTestResultCopy {
  const primary = ARCHETYPE_READINGS_V2[input.primarySpec];
  const secondary = ARCHETYPE_READINGS_V2[input.secondarySpec];

  const datingLoop = evaluatePatternFlags({
    motiveScores: input.motiveScores,
    lenses: input.lenses,
    attachment: input.attachment,
  });

  let sparkPartnershipTwist: SpecTestResultCopy["sparkPartnershipTwist"] = null;
  if (input.confidence === "split") {
    const sparkReading = ARCHETYPE_READINGS_V2[input.sparkPrimarySpec];
    const partnershipReading = ARCHETYPE_READINGS_V2[input.partnershipPrimarySpec];
    sparkPartnershipTwist = {
      sparkSpec: input.sparkPrimarySpec,
      sparkName: sparkReading.name,
      partnershipSpec: input.partnershipPrimarySpec,
      partnershipName: partnershipReading.name,
      copy: `Here's the twist: two different signals showed up in your answers, and that's completely normal, not a contradiction. What actually catches your eye lines up with ${sparkReading.name}, ${inlineTagline(sparkReading.tagline)}. But what you need to make something last leans more toward ${partnershipReading.name}, ${inlineTagline(partnershipReading.tagline)}. Neither one is wrong. Your best match is just someone who can give you both: the spark that hooks you, and the steadiness that keeps it going.`,
    };
  }

  return {
    primarySpec: input.primarySpec,
    secondarySpec: input.secondarySpec,
    headline: { name: primary.name, tagline: primary.tagline },
    secondaryInfluence: `You've got a real second layer here too. Right behind it: ${secondary.name}, ${inlineTagline(secondary.tagline)}.`,
    corePull: primary.coreReading,
    topMotives: topMotiveSignals(input.motiveScores),
    lensInsight: topLensInsight(input.lenses),
    whatItSaysAboutYou: primary.whatItSaysAboutYou,
    attachmentInsight: attachmentInsight(input.attachment),
    datingLoop,
    strength: primary.strength,
    blindSpot: primary.blindSpot,
    longTermFit: primary.longTermFit,
    growthPrompt: primary.growthPrompt,
    confidence: input.confidence,
    confidenceLabel: CONFIDENCE_COPY[input.confidence],
    sparkPartnershipTwist,
  };
}
