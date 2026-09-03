import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { viewLockedPost, CONTENT_ACCESS_REASONS, type ContentAccessReason } from "@/lib/admin/content";
import { readJson } from "@/lib/security/request";

function isContentAccessReason(value: unknown): value is ContentAccessReason {
  return typeof value === "string" && (CONTENT_ACCESS_REASONS as readonly string[]).includes(value);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const gate = await requireCapability(session?.user?.id, "view_locked_content");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await readJson(req)) as { reason?: unknown; detail?: unknown } | null;
  if (!isContentAccessReason(body?.reason)) {
    return NextResponse.json({ error: "Select a reason for access" }, { status: 400 });
  }
  const detail = typeof body?.detail === "string" ? body.detail.trim().slice(0, 500) : undefined;

  const result = await viewLockedPost(params.id, session!.user.id, body.reason, detail);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, post: result.post }, { status: 200 });
}
