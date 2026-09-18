import "server-only";

// server-only. Phase 7 calibration tooling (docs/spec-test-v2-implementation-plan.md §12).
//
// What's implemented here: item analytics (choice frequency, position bias, skip rate,
// elapsed-time), computed entirely from data already stored in every v2 row's `answers`
// column - no new instrumentation needed, and nothing here is per-respondent identifying.
//
// What's deliberately NOT implemented, and why:
// - "Consented export" of raw per-respondent scored data (plan §12) is not built. The only
//   consent this product currently collects is `consentMarketing` ("Keep me updated about
//   Udala") on the result-page email form - a marketing opt-in, not a research opt-in. Using
//   it to gate a psychometric-analysis export would consent-launder a marketing checkbox into
//   research consent, which is exactly the kind of thing report §9's data-minimization and
//   consent-separation rules exist to prevent. A real export needs its own explicit consent
//   surface first; building the export ahead of that consent UX was judged worse than not
//   building it yet.
// - Test-retest linkage (plan §12) is not built. Reliably identifying "the same anonymous
//   taker" across two separate quiz attempts needs a persistent identifier this product
//   doesn't collect (email is optional and only captured after a result already exists) -
//   building that requires new consent UX of its own, same as the export above.
// Both are flagged here rather than faked with an approximation.

import { prisma } from "@/lib/prisma";
import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { SPEC_TEST_ITEMS_V3, V3_INSTRUMENT_VERSION } from "@/lib/spec-test/items/spec-v3";
import { INSTRUMENT_VERSION } from "@/lib/spec-test/taxonomy";
import type { SpecTestResponseV2, SpecTestResponseV3 } from "@/lib/spec-test/response";
import type { QuizForm } from "@/lib/spec-test/gender/forms";

export type ItemOptionAnalytics = {
  optionId: string;
  /** Raw, tokenized item-bank label. The admin surface renders it with neutral terms so an
   *  analyst can inspect what respondents actually saw without duplicating item content. */
  label: string;
  chosenCount: number;
  /** Share of this item's ANSWERED (non-skipped) responses that picked this option. */
  choiceRate: number;
};

export type ItemAnalytics = {
  itemId: string;
  answeredCount: number;
  skippedCount: number;
  skipRate: number;
  medianElapsedMs: number;
  /**
   * How many times each on-screen position (0-3) was the one chosen, across all takers. With
   * option order randomized per taker (lib/spec-test/items - "Randomize answer order"), an
   * even ~25% split across positions is the null hypothesis; a skewed distribution here is
   * evidence of position bias (people favoring wherever an option happens to land on screen)
   * rather than genuine content preference.
   */
  positionCounts: [number, number, number, number];
  options: ItemOptionAnalytics[];
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Item-level diagnostics for one instrument version, computed over every persisted response
 * regardless of development/hold-out split - these are item-quality checks, not model
 * fitting, so there's no reason to withhold the hold-out half from them.
 *
 * `quizForm` (gender plan Phase G6, report §10 "item completion time" and "option
 * distribution" by form) narrows to one form's rows when given; omitted, it's the combined
 * figure across both forms exactly as before this parameter existed.
 */
export async function getSpecTestItemAnalytics(
  instrumentVersion: string = INSTRUMENT_VERSION,
  quizForm?: QuizForm,
): Promise<ItemAnalytics[]> {
  const rows = await prisma.specTestResult.findMany({
    where: quizForm ? { instrumentVersion, quizForm } : { instrumentVersion },
    select: { answers: true },
  });

  type Bucket = {
    answered: number;
    skipped: number;
    elapsed: number[];
    positions: [number, number, number, number];
    optionCounts: Map<string, number>;
  };

  const bank = instrumentVersion === V3_INSTRUMENT_VERSION
    ? SPEC_TEST_ITEMS_V3.map((item) => ({
        id: item.id,
        options: item.kind === "intensity"
          ? ([1, 2, 3, 4, 5, 6, 7] as const).map((rating) => ({
              id: `rating-${rating}`,
              label: rating === 1 ? `1 — ${item.lowLabel}` : rating === 7 ? `7 — ${item.highLabel}` : String(rating),
            }))
          : item.options,
      }))
    : SPEC_TEST_ITEMS_V2.map((item) => ({ id: item.id, options: item.options }));
  const byItem = new Map<string, Bucket>();
  for (const item of bank) {
    byItem.set(item.id, { answered: 0, skipped: 0, elapsed: [], positions: [0, 0, 0, 0], optionCounts: new Map() });
  }

  for (const row of rows) {
    const responses = row.answers;
    if (!Array.isArray(responses)) continue;

    for (const raw of responses as unknown as Array<SpecTestResponseV2 | SpecTestResponseV3>) {
      const bucket = byItem.get(raw?.itemId);
      if (!bucket) continue;

      const isSkipped = raw.skipped ||
        ("kind" in raw && raw.kind === "best_worst" && (!raw.bestOptionId || !raw.worstOptionId)) ||
        ("kind" in raw && raw.kind === "intensity" && raw.rating === null) ||
        ("optionId" in raw && raw.optionId === null);
      if (isSkipped) {
        bucket.skipped += 1;
        continue;
      }

      bucket.answered += 1;
      if (typeof raw.elapsedMs === "number") bucket.elapsed.push(raw.elapsedMs);
      if ("kind" in raw && raw.kind === "best_worst") {
        if (typeof raw.bestPresentedIndex === "number") bucket.positions[raw.bestPresentedIndex] += 1;
        if (raw.bestOptionId) bucket.optionCounts.set(raw.bestOptionId, (bucket.optionCounts.get(raw.bestOptionId) ?? 0) + 1);
      } else if ("kind" in raw && raw.kind === "intensity") {
        const optionId = `rating-${raw.rating}`;
        bucket.optionCounts.set(optionId, (bucket.optionCounts.get(optionId) ?? 0) + 1);
      } else if ("optionId" in raw && raw.optionId) {
        if (typeof raw.presentedIndex === "number" && raw.presentedIndex >= 0 && raw.presentedIndex <= 3) {
          bucket.positions[raw.presentedIndex] += 1;
        }
        bucket.optionCounts.set(raw.optionId, (bucket.optionCounts.get(raw.optionId) ?? 0) + 1);
      }
    }
  }

  return bank.map((item) => {
    const bucket = byItem.get(item.id) as Bucket;
    const total = bucket.answered + bucket.skipped;

    return {
      itemId: item.id,
      answeredCount: bucket.answered,
      skippedCount: bucket.skipped,
      skipRate: total > 0 ? bucket.skipped / total : 0,
      medianElapsedMs: median(bucket.elapsed),
      positionCounts: bucket.positions,
      options: item.options.map((option) => {
        const chosenCount = bucket.optionCounts.get(option.id) ?? 0;
        return {
          optionId: option.id,
          label: option.label,
          chosenCount,
          choiceRate: bucket.answered > 0 ? chosenCount / bucket.answered : 0,
        };
      }),
    };
  });
}

export type DataSplitCounts = {
  development: number;
  holdout: number;
};

export async function getSpecTestDataSplitCounts(instrumentVersion: string = INSTRUMENT_VERSION): Promise<DataSplitCounts> {
  const rows = await prisma.specTestResult.groupBy({
    by: ["dataSplit"],
    where: { instrumentVersion },
    _count: { _all: true },
  });

  const bySplit = Object.fromEntries(rows.map((row) => [row.dataSplit, row._count._all]));
  return {
    development: bySplit.development ?? 0,
    holdout: bySplit.holdout ?? 0,
  };
}
