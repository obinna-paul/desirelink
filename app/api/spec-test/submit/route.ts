import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSpecType, scoreSpecTestAnswers, specTestQuestionIds, type SpecTestAnswers } from "@/lib/spec-test";
import { itemBankForVersion } from "@/lib/spec-test/items";
import { decideSpecTestResultForVersion } from "@/lib/spec-test/scoring/decide";
import { evaluatePatternFlags } from "@/lib/spec-test/interpretation/pattern-flags";
import { INSTRUMENT_VERSION } from "@/lib/spec-test/taxonomy";
import { GENDERS, routeForm } from "@/lib/spec-test/gender/forms";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { getClientIp, readJson } from "@/lib/security/request";
import { setSpecTestResultCookie } from "@/lib/spec-test/claim-cookie";
import { getActiveRetakeCooldown } from "@/lib/spec-test/retake";

/**
 * Accepts two request shapes on one endpoint:
 *
 * - legacy v1: `{ answers: { [questionId]: "A"|"B"|"C"|"D" } }` - unchanged behavior. Nothing
 *   in this codebase sends this anymore (components/spec-test/quiz-flow.tsx was rewritten in
 *   Phase 3 to send the v2 shape below), but the branch is kept as a compatibility safety net
 *   rather than deleted outright - see that Phase 3 commit's own note on why.
 * - v2: `{ instrumentVersion, responses: SpecTestResponseV2[], contextAnswers? }` - the engine
 *   from docs/spec-test-v2-implementation-plan.md Phases 1-4, the only shape the live quiz
 *   wizard sends.
 *
 * A v2 submission from a signed-in session is linked to that profile immediately (no
 * email-capture step needed - see submitV2's `profileId` write) and is subject to a 30-day
 * retake cooldown; an anonymous submission is unlinked and uncapped, same as always, and gets
 * a claim cookie (lib/spec-test/claim-cookie.ts) so it can still be claimed at signup by id,
 * whether or not the taker ever gives an email via the result page's "email me this" card -
 * see claimSpecTestResultById and linkSpecTestResultToProfile in lib/spec-test/legacy.ts for
 * the two independent ways a signup can pick it up.
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

/** Share of new v2 results reserved as a hold-out sample a future psychometric refit can
 *  validate on without having been fit on it (report §8 Phase 3; plan §12). */
const HOLDOUT_RATE = 0.2;

function assignDataSplit(): "development" | "holdout" {
  return Math.random() < HOLDOUT_RATE ? "holdout" : "development";
}

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

/** Same counter, broken out per quizForm (gender plan Phase G6) - the by-form low-signal rate
 *  has the identical "no row exists to count" problem the function above solves, just scoped
 *  to a form instead of the whole instrument. Only called when a form is actually known
 *  (i.e. gender was supplied), so a v2.0 or malformed submission simply never bumps it rather
 *  than being forced into a fake bucket. Also best-effort, same rationale as above. */
async function bumpFormStat(instrumentVersion: string, quizForm: string, field: "submittedCount" | "lowSignalCount") {
  try {
    await prisma.specTestFormStat.upsert({
      where: { instrumentVersion_quizForm: { instrumentVersion, quizForm } },
      create: { instrumentVersion, quizForm, [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  } catch (error) {
    console.error("[spec-test] failed to bump form stat", instrumentVersion, quizForm, field, error);
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
  // Required only for the current instrument version (checked below, not by zod) - a v2.0
  // fixture/legacy submission is unaffected (plan §8 acceptance criteria: "A v2.1 submission
  // without a gender is rejected; a v2.0 submission is unaffected"). Never a `quizForm` field
  // here: the form is always derived server-side from gender via routeForm(), never accepted
  // as client input (plan §8: "quizForm is always server-derived").
  gender: z.enum(GENDERS).optional(),
  responses: z.array(v2ResponseSchema),
  contextAnswers: z.record(z.unknown()).optional(),
});

async function submitV2(payload: z.infer<typeof v2PayloadSchema>, viewerProfileId: string | null): Promise<NextResponse> {
  const bank = itemBankForVersion(payload.instrumentVersion);
  if (!bank) {
    return NextResponse.json({ error: "Unknown instrument version." }, { status: 400 });
  }

  if (viewerProfileId) {
    const cooldown = await getActiveRetakeCooldown(viewerProfileId);
    if (cooldown) {
      // Include the id of the result this cap is protecting, not just the rejection - a
      // taker hitting this is, by definition, someone who already has a scored result. The
      // client uses this to send them straight to it instead of dead-ending on a retry
      // button that would only hit this same 429 again (see quiz-flow.tsx's submit()).
      return NextResponse.json(
        {
          error: `You can retake the Spec Test on ${cooldown.nextEligibleAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`,
          nextEligibleAt: cooldown.nextEligibleAt.toISOString(),
          resultId: cooldown.resultId,
        },
        { status: 429 },
      );
    }
  }

  if (payload.instrumentVersion === INSTRUMENT_VERSION && !payload.gender) {
    return NextResponse.json({ error: "Select a gender to continue." }, { status: 400 });
  }

  // Routed here, once, from the validated gender only - this is the single point where a
  // client-supplied value could otherwise be trusted, and it isn't.
  const routing = payload.gender ? routeForm(payload.gender) : null;

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
  const decision = decideSpecTestResultForVersion(payload.instrumentVersion, bank, responses);

  if (decision.confidence === "low_signal") {
    // report §6.2: "Offer a retake rather than false precision" - nothing shareable exists
    // for a low-signal response, so no row is written and no resultId is returned.
    await bumpInstrumentStat(payload.instrumentVersion, "lowSignalCount");
    if (routing) await bumpFormStat(payload.instrumentVersion, routing.quizForm, "lowSignalCount");
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
      dataSplit: assignDataSplit(),
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
      gender: payload.gender,
      routingRule: routing?.routingRule,
      assumedAttractionTarget: routing?.assumedAttractionTarget,
      quizForm: routing?.quizForm,
      // Signed-in takers never need any of what follows to link their result to their
      // account - the session already tells us who they are, so it's linked the moment the
      // result exists. An anonymous taker gets a claim cookie instead (see below), which
      // covers signup regardless of whether they ever use the "email me this" card.
      profileId: viewerProfileId,
    },
    select: { id: true },
  });

  if (!viewerProfileId) {
    // See lib/spec-test/claim-cookie.ts - covers "took the quiz, then clicked Join Udala"
    // without the taker ever having to type an email on the result page.
    setSpecTestResultCookie(result.id);
  }

  await bumpInstrumentStat(payload.instrumentVersion, "submittedCount");
  if (routing) await bumpFormStat(payload.instrumentVersion, routing.quizForm, "submittedCount");

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

    const session = await getServerSession(authOptions);
    const viewerProfile = session?.user?.id
      ? await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
      : null;

    return await submitV2(parsed.data, viewerProfile?.id ?? null);
  } catch (error) {
    console.error("[spec-test] failed to save result", error);
    return NextResponse.json(
      { error: "Something went wrong saving your result. Please try again in a moment." },
      { status: 500 },
    );
  }
}
