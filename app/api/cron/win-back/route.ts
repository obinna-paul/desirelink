import { NextResponse } from "next/server";

import { runWinBack } from "@/lib/email/growth-jobs";
import { isCronAuthorized } from "@/lib/security/cron";

/** Meant to run daily (see vercel.json). See runWinBack in
 * lib/email/growth-jobs.ts for what it actually does and how it dedupes. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runWinBack();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
