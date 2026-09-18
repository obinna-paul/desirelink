import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { V3_PILOT_INSTRUMENT_VERSION } from "@/lib/spec-test/items/spec-v3-pilot";
import { isV3PilotEnabled, V3_PILOT_CONSENT_VERSION } from "@/lib/spec-test/pilot-v3-feature";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { getClientIp, readJson } from "@/lib/security/request";

const payloadSchema = z.object({
  attemptId: z.string().uuid(),
  instrumentVersion: z.literal(V3_PILOT_INSTRUMENT_VERSION),
  consentVersion: z.literal(V3_PILOT_CONSENT_VERSION),
  completedCount: z.number().int().min(0).max(28),
});

export async function POST(request: Request) {
  if (!isV3PilotEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ip = getClientIp(request);
  const limit = checkRateLimit(`spec-test-v3-pilot-progress:${ip}`, {
    limit: 300,
    windowMs: 60 * 60 * 1_000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const parsed = payloadSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid pilot progress." }, { status: 400 });

  const { attemptId, instrumentVersion, consentVersion, completedCount } = parsed.data;
  try {
    await prisma.specTestPilotAttempt.upsert({
      where: { id: attemptId },
      create: {
        id: attemptId,
        instrumentVersion,
        consentVersion,
        highestCompletedIndex: completedCount,
      },
      // Never set the counter downward in the upsert. The conditional update below raises it
      // only when needed, which remains monotonic even if progress requests arrive out of order.
      update: {},
    });
    await prisma.specTestPilotAttempt.updateMany({
      where: { id: attemptId, highestCompletedIndex: { lt: completedCount } },
      data: { highestCompletedIndex: completedCount },
    });
    return NextResponse.json({ recorded: true });
  } catch (error) {
    console.error("[spec-test-v3-pilot] failed to record anonymous progress", error);
    return NextResponse.json({ error: "Progress was not recorded." }, { status: 500 });
  }
}
