import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { resolveSpecType, scoreSpecTestAnswers, specTestQuestionIds, type SpecTestAnswers } from "@/lib/spec-test";
import { itemBankForVersion } from "@/lib/spec-test/items";
import { decideSpecTestResult } from "@/lib/spec-test/scoring/decide";
import { evaluatePatternFlags } from "@/lib/spec-test/interpretation/pattern-flags";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { getClientIp, readJson } from "@/lib/security/request";

/**
 * Accepts two request shapes on one endpoint:
 *
 * - legacy v1: `{ answers: { [questionId]: "A"|"B"|"C"|"D" } }` - unchanged behavior, kept so
 *   the live quiz (components/spec-test/quiz-flow.tsx, not yet rewritten) keeps working.
 * - v2: `{ instrumentVersion, responses: SpecTestResponseV2[], contextAnswers? }` - the new
 *   engine from docs/spec-test-v2-implementation-plan.md Phase 1/2. Not yet called by any UI;
 *   Phase 3 wires the rewritten quiz wizard to it.
 *
 * Per the plan §15, the two paths are meant to be short-lived together: once Phase 3 ships
 * the v2 quiz wizard, the legacy branch (and the v1-only quiz-flow.tsx it serves) can be
 * retired in the same change that flips the switch, rather than leaving takers on a
 * half-migrated instrument in the meantime.
 */

const QUESTION_IDS = new Set(specTestQuestionIds());
const VALID_LEGACY_OPTIONS = new Set(["A", "B", "C", "D"]);

function isValidLegacyAnswers(value: unknown): value is SpecTestAnswers {
  if (!value || typeof value !== "object") return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length !== QUESTION_IDS.size) return false;
  return entries.every(([questionId, option]) => QUESTION_IDS.has(questionId) && VALID_LEGACY_OPTIONS.has(option as string));
}

async function submitLegacy(answers: SpecTestAnswers): Promise<NextResponse> {
  // Scored server-side only - a client-submitted result could never be trusted, and the
  // scoring/weighting logic is deliberately not shipped to the browser at all.
  const scores = scoreSpecTestAnswers(answers);
  const specType = resolveSpecType(scores);

  const result = await prisma.specTestResult.create({
    data: { specType, scores, answers },
    select: { id: true },
  });

  return NextResponse.json({ resultId: result.id }, { status: 201 });
}

const GENERIC_V2_ERROR = "Answer set does not match this version of the quiz.";

/** Increments the one counter that lets the admin dashboard compute a real low-signal rate
 *  (plan §11) - a low-signal submission never becomes its own SpecTestResult row, so without
 *  this there would be no denominator for that rate at all. Best-effort: a failure here must
 *  never block the response the taker is waiting on. */
async function bumpInstrumentStat(instrumentVersion: string, field: "submittedCount" | "lowSignalCount") {
  try {
    await prisma.specTestInstrumentStat.upsert({
      where: { instrumentVersion },
      create: { instrumentVersion, [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  } catch (error) {
    console.error("[spec-test] failed to bump instrument stat", instrumentVersion, field, error);
  }
}

const v2ResponseSchema = z.object({
  itemId: z.string().min(1),
  optionId: z.string().min(1).nullable(),
  presentedIndex: z.number().int().min(0).max(3).nullable(),
  elapsedMs: z.number().finite().min(0),
  skipped: z.boolean().optional(),
});

const v2PayloadSchema = z.object({
  instrumentVersion: z.string().min(1),
  responses: z.array(v2ResponseSchema),
  contextAnswers: z.record(z.unknown()).optional(),
});

async function submitV2(payload: z.infer<typeof v2PayloadSchema>): Promise<NextResponse> {
  const bank = itemBankForVersion(payload.instrumentVersion);
  if (!bank) {
    return NextResponse.json({ error: "Unknown instrument version." }, { status: 400 });
  }

  // Every item in the declared bank must appear exactly once - this is what "rejects a
  // payload whose items do not match the declared instrumentVersion" (plan §7) means in
  // practice: no missing items, no duplicates, no ids from a different version's bank.
  if (payload.responses.length !== bank.length) {
    return NextResponse.json({ error: GENERIC_V2_ERROR }, { status: 400 });
  }

  const bankById = new Map(bank.map((item) => [item.id, item]));
  const seenItemIds = new Set<string>();

  for (const response of payload.responses) {
    const item = bankById.get(response.itemId);
    if (!item || seenItemIds.has(response.itemId)) {
      return NextResponse.json({ error: GENERIC_V2_ERROR }, { status: 400 });
    }
    seenItemIds.add(response.itemId);

    const isSkipped = response.skipped === true || response.optionId === null;
    if (!isSkipped) {
      const validOptionIds = new Set(item.options.map((option) => option.id));
      if (!response.optionId || !validOptionIds.has(response.optionId)) {
        return NextResponse.json({ error: GENERIC_V2_ERROR }, { status: 400 });
      }
    }
  }

  if (seenItemIds.size !== bankById.size) {
    return NextResponse.json({ error: GENERIC_V2_ERROR }, { status: 400 });
  }

  const responses: SpecTestResponseV2[] = payload.responses.map((response) => ({
    itemId: response.itemId,
    optionId: response.skipped ? null : response.optionId,
    presentedIndex: response.skipped ? null : response.presentedIndex,
    elapsedMs: response.elapsedMs,
    skipped: response.skipped,
  }));

  // Scored server-side only, same rationale as the legacy path above.
  const decision = decideSpecTestResult(bank, responses);

  if (decision.confidence === "low_signal") {
    // report §6.2: "Offer a retake rather than false precision" - nothing shareable exists
    // for a low-signal response, so no row is written and no resultId is returned.
    await bumpInstrumentStat(payload.instrumentVersion, "lowSignalCount");
    return NextResponse.json({ lowSignal: true, flags: decision.qualityFlags }, { status: 200 });
  }

  const result = await prisma.specTestResult.create({
    data: {
      specType: decision.primarySpec,
      instrumentVersion: payload.instrumentVersion,
      // "scores" is unused for v2 reads (see lib/spec-test/results.ts) - the archetype
      // probabilities are kept here only for future calibration (plan §12).
      scores: decision.probabilities,
      answers: responses,
      secondarySpec: decision.secondarySpec,
      motiveScores: { motives: decision.motiveScores, facets: decision.motiveFacets },
      lenses: decision.lenses,
      attachment: decision.attachment === null ? Prisma.JsonNull : decision.attachment,
      sparkSpec: decision.sparkPrimarySpec,
      partnershipSpec: decision.partnershipPrimarySpec,
      // Persisted as a snapshot for admin analytics only - the result page (Phase 5) always
      // recomputes the live set from motiveScores/lenses/attachment via compose.ts, so a
      // future change to these rules applies retroactively without a backfill here.
      patternFlags: evaluatePatternFlags({
        motiveScores: decision.motiveScores,
        lenses: decision.lenses,
        attachment: decision.attachment,
      }).map((flag) => flag.id),
      resultConfidence: decision.confidence,
      responseQuality: decision.quality,
      contextAnswers: payload.contextAnswers ? (payload.contextAnswers as Prisma.InputJsonValue) : undefined,
    },
    select: { id: true },
  });

  await bumpInstrumentStat(payload.instrumentVersion, "submittedCount");

  return NextResponse.json({ resultId: result.id, confidence: decision.confidence }, { status: 201 });
}

export async function POST(req: Request) {
  const body = await readJson(req);

  // Public, unauthenticated, and now writes a substantially larger row than v1 - rate limit
  // by IP regardless of which payload shape is used (plan §7 acceptance criteria).
  const ip = getClientIp(req);
  const limit = checkRateLimit(`spec-test-submit:${ip}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  try {
    if (body && typeof body === "object" && "answers" in (body as Record<string, unknown>)) {
      const answers = (body as { answers?: unknown }).answers;
      if (!isValidLegacyAnswers(answers)) {
        return NextResponse.json({ error: `Answer all ${QUESTION_IDS.size} questions to see your result.` }, { status: 400 });
      }
      return await submitLegacy(answers);
    }

    const parsed = v2PayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: GENERIC_V2_ERROR }, { status: 400 });
    }
    return await submitV2(parsed.data);
  } catch (error) {
    console.error("[spec-test] failed to save result", error);
    return NextResponse.json(
      { error: "Something went wrong saving your result. Please try again in a moment." },
      { status: 500 },
    );
  }
}
