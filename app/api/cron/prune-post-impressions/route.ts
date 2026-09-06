import { NextResponse } from "next/server";

import { pruneOldPostImpressions } from "@/lib/post-daily-stats";
import { isCronAuthorized } from "@/lib/security/cron";

/** Meant to run daily (see vercel.json), after the rollup cron. See
 * pruneOldPostImpressions in lib/post-daily-stats.ts for the retention window. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await pruneOldPostImpressions();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
