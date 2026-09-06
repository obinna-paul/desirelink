import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/security/request";
import { setProfileInterests } from "@/lib/topics";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, interestsPromptShownAt: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await readJson(req);
  const topicIds =
    Array.isArray((body as { topicIds?: unknown })?.topicIds)
      ? (body as { topicIds: unknown[] }).topicIds.filter((id): id is string => typeof id === "string")
      : [];

  await setProfileInterests(profile.id, topicIds);

  if (!profile.interestsPromptShownAt) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: { interestsPromptShownAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
