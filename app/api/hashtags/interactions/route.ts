import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { normalizeHashtag } from "@/lib/hashtags";
import { prisma } from "@/lib/prisma";
import { logSearchInteraction } from "@/lib/search";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  const tag = normalizeHashtag(typeof body?.tag === "string" ? body.tag : "").slice(0, 50);
  if (!tag) {
    return NextResponse.json({ error: "Hashtag required" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (profile) await logSearchInteraction(profile.id, `#${tag}`, 1);

  return NextResponse.json({ ok: true });
}
