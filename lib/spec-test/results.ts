import "server-only";

// server-only. A single read model for a persisted SpecTestResult row, branching on
// `instrumentVersion` so callers (the result page in Phase 5, the email route in Phase 6)
// never have to know whether they're looking at a v1 or v2 row - see
// docs/spec-test-v2-implementation-plan.md §7 "lib/spec-test/results.ts".

import { prisma } from "@/lib/prisma";
import { SPEC_TYPE_READINGS, type SpecTypeKey, type SpecTypeReading } from "@/lib/spec-test/legacy";
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
  sparkSpec: ArchetypeKey | null;
  partnershipSpec: ArchetypeKey | null;
  /** Set by the Phase 4 interpretation engine, not by submission - empty until that ships. */
  patternFlags: string[];
};

export type SpecTestReading = SpecTestReadingV1 | SpecTestReadingV2;

type MotiveScoresJson = { motives: Record<MotiveKey, number>; facets: MotiveFacetScores };

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
    },
  });
  if (!row) return null;

  if (row.instrumentVersion === "spec-v1") {
    const reading = SPEC_TYPE_READINGS[row.specType as SpecTypeKey];
    if (!reading) return null;
    return { version: "v1", id: row.id, specType: row.specType as SpecTypeKey, reading };
  }

  if (!row.secondarySpec || !row.motiveScores || !row.lenses || !row.resultConfidence) {
    return null;
  }

  const motiveScoresJson = row.motiveScores as unknown as MotiveScoresJson;

  return {
    version: "v2",
    id: row.id,
    instrumentVersion: row.instrumentVersion,
    primarySpec: row.specType as ArchetypeKey,
    secondarySpec: row.secondarySpec as ArchetypeKey,
    confidence: row.resultConfidence as Exclude<ResultConfidence, "low_signal">,
    motiveScores: motiveScoresJson.motives,
    motiveFacets: motiveScoresJson.facets,
    lenses: row.lenses as unknown as Record<LensKey, number>,
    attachment: (row.attachment as unknown as AttachmentReadout | null) ?? null,
    sparkSpec: (row.sparkSpec as ArchetypeKey | null) ?? null,
    partnershipSpec: (row.partnershipSpec as ArchetypeKey | null) ?? null,
    patternFlags: row.patternFlags,
  };
}
