import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Mirrors app/api/profile/creator-welcome-seen/route.ts's pattern exactly - marks the
 *  "What's your spec?" nudge as shown so it never shows again, from either surface that can
 *  render it (see Profile.specTestNudgeShownAt). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.profile.updateMany({
    where: { userId: session.user.id, specTestNudgeShownAt: null },
    data: { specTestNudgeShownAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
