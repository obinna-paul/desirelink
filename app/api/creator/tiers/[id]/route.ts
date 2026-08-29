import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorProfileByUserId } from "@/lib/creator";
import { creatorTierSchema } from "@/lib/validations/creator-tier";
import { readJson } from "@/lib/security/request";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getCreatorProfileByUserId(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile required" }, { status: 403 });
  }

  const existing = await prisma.creatorTier.findUnique({ where: { id: params.id } });
  if (!existing || existing.creatorId !== profile.id) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  const body = await readJson(req);
  const parsed = creatorTierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, description, priceDollars, tierType, maxSubscribers, isLimited, requiresApproval } =
    parsed.data;

  const tier = await prisma.creatorTier.update({
    where: { id: params.id },
    data: {
      name,
      description,
      priceCents: Math.round(priceDollars * 100),
      tierType,
      maxSubscribers,
      isLimited,
      requiresApproval,
    },
  });

  return NextResponse.json({ tier }, { status: 200 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getCreatorProfileByUserId(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile required" }, { status: 403 });
  }

  const existing = await prisma.creatorTier.findUnique({ where: { id: params.id } });
  if (!existing || existing.creatorId !== profile.id) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  await prisma.creatorTier.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true }, { status: 200 });
}
