import { NextResponse } from "next/server";

import { runProfileNudges } from "@/lib/email/lifecycle-jobs";
import { isCronAuthorized } from "@/lib/security/cron";

/** Meant to run daily (see vercel.json). See runProfileNudges in
 * lib/email/lifecycle-jobs.ts for what it actually does and how it dedupes. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runProfileNudges();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
