import { NextResponse } from "next/server";

import { processScheduledLiveStreams } from "@/lib/live-streams";
import { isCronAuthorized } from "@/lib/security/cron";

/**
 * Meant to run every 1-5 minutes (see vercel.json) - notifies subscribers and the creator
 * once a scheduled live is within STARTING_SOON_WINDOW_MINUTES, and auto-ends any scheduled
 * stream whose creator never showed up. See processScheduledLiveStreams in lib/live-streams.ts.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await processScheduledLiveStreams();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}
