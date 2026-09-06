import { NextResponse } from "next/server";

import { refreshPostQuality } from "@/lib/post-quality";
import { isCronAuthorized } from "@/lib/security/cron";

/** Meant to run daily (see vercel.json), after rollup-post-daily-stats has already updated
 * PostDailyStats for the day. See refreshPostQuality in lib/post-quality.ts for the formula. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await refreshPostQuality();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
