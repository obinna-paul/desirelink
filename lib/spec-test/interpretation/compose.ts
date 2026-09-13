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
import type { AttachmentScore } from "@/lib/spec-test/scoring/score";
import type { ArchetypeKey, LensKey, MotiveKey, ResultConfidence } from "@/lib/spec-test/taxonomy";

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

export type SpecTestResultCopy = {
  primarySpec: ArchetypeKey;
  secondarySpec: ArchetypeKey;
  headline: { name: string; tagline: string };
  /** report §7 "Secondary influence" module. */
  secondaryInfluence: string;
  /** report §7 "Core pull" module. */
  corePull: string;
  whatItSaysAboutYou: string;
  /** report §7 "Dating loop" module - only the flags whose conditions actually converged. */
  datingLoop: TriggeredPatternFlag[];
  strength: string;
  blindSpot: string;
  longTermFit: string;
  growthPrompt: string;
  confidence: Exclude<ResultConfidence, "low_signal">;
  confidenceLabel: string;
  /** report §7/§10 "who pulls you in vs who works for you" - present only on a split result. */
  sparkPartnershipTwist: { sparkSpec: ArchetypeKey; sparkName: string; partnershipSpec: ArchetypeKey; partnershipName: string; copy: string } | null;
};

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
      copy: `Plot twist: what pulls you in and what actually keeps you aren't quite the same thing. Your Spark answers point to ${sparkReading.name}; your Partnership answers point to ${partnershipReading.name}. That doesn't mean your spark was wrong about anything - it means your best match gives you the thing that hooks you without making the everyday stuff a struggle.`,
    };
  }

  return {
    primarySpec: input.primarySpec,
    secondarySpec: input.secondarySpec,
    headline: { name: primary.name, tagline: primary.tagline },
    secondaryInfluence: `Right behind it: ${secondary.name} - ${secondary.tagline}`,
    corePull: primary.coreReading,
    whatItSaysAboutYou: primary.whatItSaysAboutYou,
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
