import { NextResponse } from "next/server";

import { refreshSearchIndex } from "@/lib/search-index";
import { isCronAuthorized } from "@/lib/security/cron";

/** Meant to run every 15 minutes (see vercel.json). See refreshSearchIndex in
 * lib/search-index.ts for what it actually rebuilds. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await refreshSearchIndex();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
