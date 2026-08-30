import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lightweight heartbeat that powers the "online for chat" ring on Home (lib/live-streams.ts) without full presence infra. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.profile.updateMany({
    where: { userId: session.user.id },
    data: { lastActiveAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
