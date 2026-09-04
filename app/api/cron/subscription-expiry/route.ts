import { NextResponse } from "next/server";

import { runSubscriptionExpiry } from "@/lib/billing";
import { isCronAuthorized } from "@/lib/security/cron";

/**
 * Meant to run daily (see vercel.json). Ends every subscription whose month is up and
 * sends the pre-expiry warning to anyone a few days out - see runSubscriptionExpiry in
 * lib/billing.ts. Subscriptions are never renewed or re-charged here; this is
 * bookkeeping and notifications on top of access that's already gated by endsAt.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runSubscriptionExpiry();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
