import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getLiveRequestPresets, normalizeLiveRequestOptions, saveLiveRequestPresets } from "@/lib/live-requests";
import { prisma } from "@/lib/prisma";

async function getProfileId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  return profile?.id ?? null;
}

export async function GET() {
  const profileId = await getProfileId();
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ requestOptions: await getLiveRequestPresets(profileId) });
}

export async function PUT(req: Request) {
  const profileId = await getProfileId();
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = normalizeLiveRequestOptions(body?.requestOptions);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await saveLiveRequestPresets(profileId, parsed.options);
  return NextResponse.json({ requestOptions: parsed.options });
}
