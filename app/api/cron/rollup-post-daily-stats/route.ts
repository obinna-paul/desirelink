import { NextResponse } from "next/server";

import { rollupPostDailyStats } from "@/lib/post-daily-stats";
import { isCronAuthorized } from "@/lib/security/cron";

/** Meant to run daily (see vercel.json), well after "yesterday" (UTC) has fully elapsed.
 * See rollupPostDailyStats in lib/post-daily-stats.ts for what it actually computes. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await rollupPostDailyStats();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
