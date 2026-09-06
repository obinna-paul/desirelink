import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PostFeedbackKind } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordPostFeedback } from "@/lib/content-feedback";

const VALID_KINDS = new Set<string>(Object.values(PostFeedbackKind));

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const postId = typeof body?.postId === "string" ? body.postId : null;
  const kind = typeof body?.kind === "string" && VALID_KINDS.has(body.kind) ? (body.kind as PostFeedbackKind) : null;
  if (!postId || !kind) {
    return NextResponse.json({ error: "postId and a valid kind are required" }, { status: 400 });
  }

  const result = await recordPostFeedback(profile.id, postId, kind);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
