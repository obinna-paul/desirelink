import "server-only";

// server-only. A single read model for a persisted SpecTestResult row, branching on
// `instrumentVersion` so callers (the result page in Phase 5, the email route in Phase 6)
// never have to know whether they're looking at a v1 or v2 row - see
// docs/spec-test-v2-implementation-plan.md §7 "lib/spec-test/results.ts".
//
// This is also where gender rendering happens (docs/spec-test-gender-implementation-plan.md
// Phase G3), deliberately NOT inside lib/spec-test/interpretation/compose.ts: compose.ts
// lives under interpretation/, which lib/spec-test/gender/scoring-boundary.test.ts asserts
// never imports the gender module, so that "gender cannot reach scoring" stays a structural
// guarantee rather than something to re-review by hand every time compose.ts changes. This
// file sits one layer above interpretation/ - it assembles the canonical (templated) reading
// via compose(), then renders it for the row's stored form as a separate, explicit step.

import { prisma } from "@/lib/prisma";
import { SPEC_TYPE_READINGS, type SpecTypeKey, type SpecTypeReading } from "@/lib/spec-test/legacy";
import { composeSpecTestResult, type SpecTestResultCopy } from "@/lib/spec-test/interpretation/compose";
import { renderTerms } from "@/lib/spec-test/gender/render";
import type { RenderForm } from "@/lib/spec-test/gender/terms";
import type { Gender, QuizForm } from "@/lib/spec-test/gender/forms";
import type { AttachmentResponseLabel, ArchetypeKey, LensKey, MotiveKey, ResultConfidence } from "@/lib/spec-test/taxonomy";

export type SpecTestReadingV1 = {
  version: "v1";
  id: string;
  specType: SpecTypeKey;
  reading: SpecTypeReading;
};

export type MotiveFacetScores = {
  containedDepthPrivacy: number;
  aestheticSelectivity: number;
};

export type AttachmentReadout = {
  anxiety: number;
  avoidance: number;
  label: AttachmentResponseLabel;
};

export type SpecTestReadingV2 = {
  version: "v2";
  id: string;
  instrumentVersion: string;
  primarySpec: ArchetypeKey;
  secondarySpec: ArchetypeKey;
  /** Never "low_signal" - a low-signal submission is never persisted (see the submit route). */
  confidence: Exclude<ResultConfidence, "low_signal">;
  motiveScores: Record<MotiveKey, number>;
  motiveFacets: MotiveFacetScores;
  lenses: Record<LensKey, number>;
  attachment: AttachmentReadout | null;
  sparkSpec: ArchetypeKey;
  partnershipSpec: ArchetypeKey;
  /** Snapshot taken at submission time - see the submit route's comment. Not what drives
   *  `copy.datingLoop` below, which is always recomputed live. */
  patternFlags: string[];
  /** Null on every pre-v2.1 row (report §9: never inferred, only ever what the taker stated). */
  gender: Gender | null;
  routingRule: string | null;
  /** What the product ASSUMED, never what the user declared - see the report's §9. */
  assumedAttractionTarget: Gender | null;
  quizForm: QuizForm | null;
  /** The assembled reading (Phase 4), rendered for this row's form (Phase G3) - headline,
   *  core pull, strength, blind spot, long-term fit, growth prompt, the triggered dating-loop
   *  modules, and the split twist if any. A row with no stored form (gender was never asked,
   *  or predates it) renders the "neutral" form. */
  copy: SpecTestResultCopy;
};

export type SpecTestReading = SpecTestReadingV1 | SpecTestReadingV2;

type MotiveScoresJson = { motives: Record<MotiveKey, number>; facets: MotiveFacetScores };

/** Renders every user-facing string in a composed reading for one form - the single place
 *  where a `{token}` template becomes final display text. Archetype `name`s are proper nouns
 *  and are never templated (see lib/spec-test/interpretation/readings-v2.ts), so only
 *  `tagline` needs rendering in `headline`. */
function renderResultCopy(copy: SpecTestResultCopy, form: RenderForm): SpecTestResultCopy {
  return {
    ...copy,
    headline: { ...copy.headline, tagline: renderTerms(copy.headline.tagline, form) },
    secondaryInfluence: renderTerms(copy.secondaryInfluence, form),
    corePull: renderTerms(copy.corePull, form),
    topMotives: copy.topMotives.map((signal) => ({ ...signal, copy: renderTerms(signal.copy, form) })),
    whatItSaysAboutYou: renderTerms(copy.whatItSaysAboutYou, form),
    attachmentInsight: copy.attachmentInsight ? { ...copy.attachmentInsight, copy: renderTerms(copy.attachmentInsight.copy, form) } : null,
    datingLoop: copy.datingLoop.map((flag) => ({ ...flag, copy: renderTerms(flag.copy, form) })),
    strength: renderTerms(copy.strength, form),
    blindSpot: renderTerms(copy.blindSpot, form),
    longTermFit: renderTerms(copy.longTermFit, form),
    growthPrompt: renderTerms(copy.growthPrompt, form),
    sparkPartnershipTwist: copy.sparkPartnershipTwist
      ? { ...copy.sparkPartnershipTwist, copy: renderTerms(copy.sparkPartnershipTwist.copy, form) }
      : null,
  };
}

/**
 * Fetches and shapes one result row. Returns null for a missing id AND for a row that is
 * present but malformed for its declared version (e.g. a v2 row missing a field the type
 * requires) - callers should treat both the same way (404), never throw a page-crashing
 * error over persisted data.
 */
export async function getSpecTestReading(id: string): Promise<SpecTestReading | null> {
  const row = await prisma.specTestResult.findUnique({
    where: { id },
    select: {
      id: true,
      specType: true,
      instrumentVersion: true,
      secondarySpec: true,
      motiveScores: true,
      lenses: true,
      attachment: true,
      sparkSpec: true,
      partnershipSpec: true,
      patternFlags: true,
      resultConfidence: true,
      gender: true,
      routingRule: true,
      assumedAttractionTarget: true,
      quizForm: true,
    },
  });
  if (!row) return null;

  if (row.instrumentVersion === "spec-v1") {
    const reading = SPEC_TYPE_READINGS[row.specType as SpecTypeKey];
    if (!reading) return null;
    return { version: "v1", id: row.id, specType: row.specType as SpecTypeKey, reading };
  }

  if (!row.secondarySpec || !row.motiveScores || !row.lenses || !row.resultConfidence || !row.sparkSpec || !row.partnershipSpec) {
    return null;
  }

  const motiveScoresJson = row.motiveScores as unknown as MotiveScoresJson;
  const primarySpec = row.specType as ArchetypeKey;
  const secondarySpec = row.secondarySpec as ArchetypeKey;
  const confidence = row.resultConfidence as Exclude<ResultConfidence, "low_signal">;
  const lenses = row.lenses as unknown as Record<LensKey, number>;
  const attachment = (row.attachment as unknown as AttachmentReadout | null) ?? null;
  const sparkSpec = row.sparkSpec as ArchetypeKey;
  const partnershipSpec = row.partnershipSpec as ArchetypeKey;
  const gender = (row.gender as Gender | null) ?? null;
  const quizForm = (row.quizForm as QuizForm | null) ?? null;
  const form: RenderForm = quizForm ?? "neutral";

  const composed = composeSpecTestResult({
    primarySpec,
    secondarySpec,
    confidence,
    motiveScores: motiveScoresJson.motives,
    lenses,
    attachment,
    sparkPrimarySpec: sparkSpec,
    partnershipPrimarySpec: partnershipSpec,
  });

  return {
    version: "v2",
    id: row.id,
    instrumentVersion: row.instrumentVersion,
    primarySpec,
    secondarySpec,
    confidence,
    motiveScores: motiveScoresJson.motives,
    motiveFacets: motiveScoresJson.facets,
    lenses,
    attachment,
    sparkSpec,
    partnershipSpec,
    patternFlags: row.patternFlags,
    gender,
    routingRule: row.routingRule,
    assumedAttractionTarget: (row.assumedAttractionTarget as Gender | null) ?? null,
    quizForm,
    copy: renderResultCopy(composed, form),
  };
}
