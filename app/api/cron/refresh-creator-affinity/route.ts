import { NextResponse } from "next/server";

import { refreshCreatorAffinity } from "@/lib/creator-affinity";
import { isCronAuthorized } from "@/lib/security/cron";

/** Meant to run daily (see vercel.json). See refreshCreatorAffinity in
 * lib/creator-affinity.ts for exactly what it computes. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await refreshCreatorAffinity();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
