import { NextResponse } from "next/server";

import { processProviderPayouts } from "@/lib/payouts";

export async function GET(req: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const today = new Date();
  if (today.getDate() !== 15 && process.env.ALLOW_MANUAL_PAYOUT_RUN !== "true") {
    return NextResponse.json(
      { error: "Payout processing runs on the 15th. Set ALLOW_MANUAL_PAYOUT_RUN=true to run manually." },
      { status: 409 }
    );
  }

  const result = await processProviderPayouts(today);
  return NextResponse.json({ ok: true, ...result });
}

