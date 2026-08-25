import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProfileViewerList, isPremiumUser, premiumLimitPayload } from "@/lib/premium";

export async function GET() {
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

  if (!(await isPremiumUser(profile.id))) {
    return NextResponse.json(
      premiumLimitPayload(
        "profile_viewers",
        "Upgrade to udala premium to see who viewed your profile."
      ),
      { status: 402 }
    );
  }

  const viewers = await getProfileViewerList(profile.id);
  return NextResponse.json({ viewers }, { status: 200 });
}
