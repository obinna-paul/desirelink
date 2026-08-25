import { NextResponse } from "next/server";

import { runSubscriptionRenewals } from "@/lib/billing";
import { isCronAuthorized } from "@/lib/security/cron";

/**
 * Meant to run daily (see vercel.json). Charges every subscription due for
 * renewal today, retries any past-due one still inside its 7-day/3-attempt
 * window, and cancels anything past-due for 30+ days. See lib/billing.ts.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runSubscriptionRenewals();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
