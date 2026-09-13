import "server-only";

// server-only. Admin-facing aggregates for the Spec Test (plan §11: "type distribution,
// confidence mix... and quiz drop-off by section"). Drop-off by section is NOT implemented
// here - it would need a beacon/telemetry endpoint recording partial progress before a quiz
// is ever submitted, which doesn't exist anywhere in this codebase yet (the client only ever
// POSTs a complete response set). Fabricating that number from what we do have would be
// worse than not showing it; it's flagged as a gap for Phase 7's analytics work instead.

import { prisma } from "@/lib/prisma";
import { SPEC_TYPE_READINGS } from "@/lib/spec-test/legacy";
import { INSTRUMENT_VERSION, type ArchetypeKey, type ResultConfidence } from "@/lib/spec-test/taxonomy";

export type SpecTypeDistributionRow = {
  specType: string;
  name: string;
  count: number;
};

/** Counts every persisted result (both instrument versions - specType is the same eight
 *  keys either way) grouped by archetype, sorted most common first. */
export async function getSpecTestTypeDistribution(): Promise<SpecTypeDistributionRow[]> {
  const rows = await prisma.specTestResult.groupBy({
    by: ["specType"],
    _count: { _all: true },
    orderBy: { _count: { specType: "desc" } },
  });

  return rows.map((row) => ({
    specType: row.specType,
    name: SPEC_TYPE_READINGS[row.specType as ArchetypeKey]?.name ?? row.specType,
    count: row._count._all,
  }));
}

export type ConfidenceMix = {
  instrumentVersion: string;
  clear: number;
  blend: number;
  split: number;
  lowSignal: number;
  /** clear + blend + split + lowSignal - every submit attempt this instrument has seen,
   *  including the ones that never became a row. */
  totalAttempts: number;
  rates: Record<ResultConfidence, number>;
};

/**
 * Confidence mix for one instrument version, including a real low-signal rate - possible
 * only because the submit route increments SpecTestInstrumentStat on every attempt (see
 * app/api/spec-test/submit/route.ts's bumpInstrumentStat), not just on a persisted row.
 */
export async function getSpecTestConfidenceMix(instrumentVersion: string = INSTRUMENT_VERSION): Promise<ConfidenceMix> {
  const [confidenceRows, stat] = await Promise.all([
    prisma.specTestResult.groupBy({
      by: ["resultConfidence"],
      where: { instrumentVersion, resultConfidence: { not: null } },
      _count: { _all: true },
    }),
    prisma.specTestInstrumentStat.findUnique({ where: { instrumentVersion } }),
  ]);

  const byConfidence = Object.fromEntries(confidenceRows.map((row) => [row.resultConfidence, row._count._all]));
  const clear = byConfidence.clear ?? 0;
  const blend = byConfidence.blend ?? 0;
  const split = byConfidence.split ?? 0;
  const lowSignal = stat?.lowSignalCount ?? 0;
  const totalAttempts = clear + blend + split + lowSignal;

  const rate = (count: number) => (totalAttempts > 0 ? count / totalAttempts : 0);

  return {
    instrumentVersion,
    clear,
    blend,
    split,
    lowSignal,
    totalAttempts,
    rates: { clear: rate(clear), blend: rate(blend), split: rate(split), low_signal: rate(lowSignal) },
  };
}
