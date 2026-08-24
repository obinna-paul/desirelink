import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { reviewModerationFlag, type ModerationAction } from "@/lib/moderation";

const ACTIONS = ["review", "remove", "warn", "suspend"] as const;

function isModerationAction(value: unknown): value is ModerationAction {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!isModerationAction(body?.action)) {
    return NextResponse.json({ error: "action must be review, remove, warn, or suspend" }, { status: 400 });
  }

  const result = await reviewModerationFlag(params.id, session.user.id, body.action);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
