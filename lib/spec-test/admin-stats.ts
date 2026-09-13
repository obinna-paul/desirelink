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
import { QUIZ_FORMS, type QuizForm } from "@/lib/spec-test/gender/forms";

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

export type FormConfidenceMix = ConfidenceMix & { quizForm: QuizForm };

/**
 * The same confidence mix as getSpecTestConfidenceMix, split by quizForm (gender plan Phase
 * G6, report §10's analytics table: "blend and low-signal rate" by form). Uses
 * SpecTestFormStat for the low-signal denominator - the same reason getSpecTestConfidenceMix
 * needs SpecTestInstrumentStat rather than counting rows: a low-signal attempt never becomes
 * its own SpecTestResult row, so there is nothing to group by quizForm there.
 */
export async function getSpecTestConfidenceMixByForm(instrumentVersion: string = INSTRUMENT_VERSION): Promise<FormConfidenceMix[]> {
  return Promise.all(
    QUIZ_FORMS.map(async (quizForm): Promise<FormConfidenceMix> => {
      const [confidenceRows, stat] = await Promise.all([
        prisma.specTestResult.groupBy({
          by: ["resultConfidence"],
          where: { instrumentVersion, quizForm, resultConfidence: { not: null } },
          _count: { _all: true },
        }),
        prisma.specTestFormStat.findUnique({ where: { instrumentVersion_quizForm: { instrumentVersion, quizForm } } }),
      ]);

      const byConfidence = Object.fromEntries(confidenceRows.map((row) => [row.resultConfidence, row._count._all]));
      const clear = byConfidence.clear ?? 0;
      const blend = byConfidence.blend ?? 0;
      const split = byConfidence.split ?? 0;
      const lowSignal = stat?.lowSignalCount ?? 0;
      const totalAttempts = clear + blend + split + lowSignal;
      const rate = (count: number) => (totalAttempts > 0 ? count / totalAttempts : 0);

      return {
        quizForm,
        instrumentVersion,
        clear,
        blend,
        split,
        lowSignal,
        totalAttempts,
        rates: { clear: rate(clear), blend: rate(blend), split: rate(split), low_signal: rate(lowSignal) },
      };
    }),
  );
}

export type FormTypeDistribution = { quizForm: QuizForm; rows: SpecTypeDistributionRow[] };

/** getSpecTestTypeDistribution, split by quizForm (gender plan Phase G6, report §10 "result
 *  distribution" by form) - unlike the confidence mix above, this needs no extra table: every
 *  persisted row already carries its own quizForm (or null, for pre-gender rows, which this
 *  intentionally excludes since they can't be attributed to either form). */
export async function getSpecTestTypeDistributionByForm(): Promise<FormTypeDistribution[]> {
  return Promise.all(
    QUIZ_FORMS.map(async (quizForm): Promise<FormTypeDistribution> => {
      const rows = await prisma.specTestResult.groupBy({
        by: ["specType"],
        where: { quizForm },
        _count: { _all: true },
        orderBy: { _count: { specType: "desc" } },
      });

      return {
        quizForm,
        rows: rows.map((row) => ({
          specType: row.specType,
          name: SPEC_TYPE_READINGS[row.specType as ArchetypeKey]?.name ?? row.specType,
          count: row._count._all,
        })),
      };
    }),
  );
}
