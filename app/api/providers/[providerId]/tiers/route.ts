import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderProfile } from "@/lib/providers";
import { getPublicTiers } from "@/lib/tiers";

export async function GET(_req: Request, { params }: { params: { providerId: string } }) {
  const provider = await getProviderProfile(params.providerId);
  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const viewerProfile = session?.user?.id
    ? await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    : null;

  const tiers = await getPublicTiers(params.providerId, viewerProfile?.id ?? null);
  return NextResponse.json({ tiers }, { status: 200 });
}
