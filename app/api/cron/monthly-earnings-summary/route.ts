import { NextResponse } from "next/server";

import { runMonthlyEarningsSummary } from "@/lib/email/growth-jobs";
import { isCronAuthorized } from "@/lib/security/cron";

/** Meant to run daily (see vercel.json) - cheap since it dedupes internally to once per
 * creator per month. See runMonthlyEarningsSummary in lib/email/growth-jobs.ts. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runMonthlyEarningsSummary();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
