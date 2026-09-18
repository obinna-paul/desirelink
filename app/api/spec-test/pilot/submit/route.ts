import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  SPEC_TEST_ITEMS_V3_PILOT,
  V3_PILOT_INSTRUMENT_VERSION,
} from "@/lib/spec-test/items/spec-v3-pilot";
import { isV3PilotEnabled, V3_PILOT_CONSENT_VERSION } from "@/lib/spec-test/pilot-v3-feature";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import {
  scoreV3PilotAttraction,
  scoreV3PilotUncertainty,
  validateV3PilotResponses,
} from "@/lib/spec-test/scoring/pilot-v3";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { getClientIp, readJson } from "@/lib/security/request";

const elapsedMs = z.number().finite().min(0).max(24 * 60 * 60 * 1_000);
const presentedIndex = z.number().int().min(0).max(3).nullable();

const responseSchema = z.discriminatedUnion("kind", [
  z.object({
    itemId: z.string().min(1),
    kind: z.literal("best_worst"),
    bestOptionId: z.string().min(1).nullable(),
    worstOptionId: z.string().min(1).nullable(),
    bestPresentedIndex: presentedIndex,
    worstPresentedIndex: presentedIndex,
    elapsedMs,
    skipped: z.boolean().optional(),
  }),
  z.object({
    itemId: z.string().min(1),
    kind: z.literal("intensity"),
    rating: z.number().int().min(1).max(7).nullable(),
    elapsedMs,
    skipped: z.boolean().optional(),
  }),
  z.object({
    itemId: z.string().min(1),
    kind: z.literal("single_choice"),
    optionId: z.string().min(1).nullable(),
    presentedIndex,
    elapsedMs,
    skipped: z.boolean().optional(),
  }),
]);

const payloadSchema = z.object({
  attemptId: z.string().uuid(),
  instrumentVersion: z.literal(V3_PILOT_INSTRUMENT_VERSION),
  researchConsent: z.literal(true),
  consentVersion: z.literal(V3_PILOT_CONSENT_VERSION),
  responses: z.array(responseSchema),
});

function assignDataSplit(): "development" | "holdout" {
  return Math.random() < 0.2 ? "holdout" : "development";
}

function qualityFlags(responses: SpecTestResponseV3[]): string[] {
  const flags: string[] = [];
  const skipped = responses.filter((response) => response.skipped).length;
  const answeredElapsedMs = responses.reduce(
    (sum, response) => sum + (response.skipped ? 0 : response.elapsedMs),
    0,
  );
  if (skipped > 3) flags.push("too_many_skips");
  if (answeredElapsedMs < Math.max(1, responses.length - skipped) * 800) flags.push("too_fast");
  return flags;
}

export async function POST(request: Request) {
  if (!isV3PilotEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(`spec-test-v3-pilot:${ip}`, { limit: 10, windowMs: 60 * 60 * 1_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many pilot submissions. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const parsed = payloadSchema.safeParse(await readJson(request));
  if (!parsed.success || parsed.data.responses.length !== SPEC_TEST_ITEMS_V3_PILOT.length) {
    return NextResponse.json({ error: "Pilot response set is incomplete or invalid." }, { status: 400 });
  }

  const responses = parsed.data.responses as SpecTestResponseV3[];
  const validationErrors = validateV3PilotResponses(SPEC_TEST_ITEMS_V3_PILOT, responses, {
    requireComplete: true,
  });
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: "Pilot response set is incomplete or invalid." }, { status: 400 });
  }

  try {
    const attractionProfile = scoreV3PilotAttraction(SPEC_TEST_ITEMS_V3_PILOT, responses);
    const uncertaintyProfile = scoreV3PilotUncertainty(SPEC_TEST_ITEMS_V3_PILOT, responses);
    const submission = await prisma.specTestPilotSubmission.create({
      data: {
        attemptId: parsed.data.attemptId,
        instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
        consentVersion: V3_PILOT_CONSENT_VERSION,
        responses: responses as Prisma.InputJsonValue,
        attractionProfile: attractionProfile as Prisma.InputJsonValue,
        uncertaintyProfile: uncertaintyProfile as Prisma.InputJsonValue,
        qualityFlags: qualityFlags(responses),
        dataSplit: assignDataSplit(),
      },
      select: { id: true },
    });

    // Best effort: the response row is authoritative if this telemetry update ever fails.
    try {
      await prisma.specTestPilotAttempt.upsert({
        where: { id: parsed.data.attemptId },
        create: {
          id: parsed.data.attemptId,
          instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
          consentVersion: V3_PILOT_CONSENT_VERSION,
          highestCompletedIndex: SPEC_TEST_ITEMS_V3_PILOT.length,
          completedAt: new Date(),
        },
        update: {
          highestCompletedIndex: SPEC_TEST_ITEMS_V3_PILOT.length,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("[spec-test-v3-pilot] submission saved but completion telemetry failed", error);
    }

    return NextResponse.json({ submissionId: submission.id }, { status: 201 });
  } catch (error) {
    console.error("[spec-test-v3-pilot] failed to save anonymous submission", error);
    return NextResponse.json({ error: "We couldn't save the pilot response." }, { status: 500 });
  }
}
