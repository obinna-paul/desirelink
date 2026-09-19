import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Records the reveal, not a particular dismissal action, so every way out is once-ever. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const claimed = await prisma.profile.updateMany({
    where: {
      userId: session.user.id,
      firstPostNudgeShownAt: null,
      posts: { none: {} },
    },
    data: { firstPostNudgeShownAt: new Date() },
  });

  // updateMany is an atomic claim: stale layouts in another tab/device receive false and
  // never render a second copy. It also prevents a prompt if a post appeared meanwhile.
  return NextResponse.json({ ok: true, show: claimed.count === 1 });
}
