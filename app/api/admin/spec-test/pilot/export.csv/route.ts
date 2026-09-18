import { randomInt } from "node:crypto";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { requireCapability } from "@/lib/admin/access";
import { recordAdminAction } from "@/lib/admin/audit";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPilotAnalysisCsv } from "@/lib/spec-test/pilot-export";
import { V3_PILOT_CONSENT_VERSION } from "@/lib/spec-test/pilot-v3-feature";
import { V3_PILOT_INSTRUMENT_VERSION } from "@/lib/spec-test/items/spec-v3-pilot";

function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const gate = await requireCapability(session?.user?.id, "view_leads");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const submissions = await prisma.specTestPilotSubmission.findMany({
    where: {
      instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
      consentVersion: V3_PILOT_CONSENT_VERSION,
    },
    select: {
      instrumentVersion: true,
      consentVersion: true,
      responses: true,
      attractionProfile: true,
      uncertaintyProfile: true,
      qualityFlags: true,
      dataSplit: true,
    },
  });

  const csv = buildPilotAnalysisCsv(shuffled(submissions));
  await recordAdminAction({
    actorId: session!.user.id,
    action: "spec_test.pilot_export",
    targetType: "SpecTestPilotSubmission",
    summary: `Exported ${submissions.length} de-identified, consented v3 pilot submissions`,
    metadata: {
      instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
      consentVersion: V3_PILOT_CONSENT_VERSION,
      submissionCount: submissions.length,
    },
  });

  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="spec-test-${V3_PILOT_INSTRUMENT_VERSION}-analysis-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
