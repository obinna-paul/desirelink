import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorProfileByUserId } from "@/lib/creator";
import { creatorTierSchema, findTierRankConflict } from "@/lib/validations/creator-tier";
import { readJson } from "@/lib/security/request";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getCreatorProfileByUserId(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile required" }, { status: 403 });
  }

  const tiers = await prisma.creatorTier.findMany({
    where: { creatorId: profile.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ tiers }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getCreatorProfileByUserId(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile required" }, { status: 403 });
  }

  const body = await readJson(req);
  const parsed = creatorTierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, description, priceNaira, tierType, maxSubscribers, isLimited } = parsed.data;
  const priceCents = Math.round(priceNaira * 100);

  const otherTiers = await prisma.creatorTier.findMany({
    where: { creatorId: profile.id },
    select: { name: true, tierType: true, priceCents: true },
  });
  const rankConflict = findTierRankConflict({ tierType, priceCents }, otherTiers);
  if (rankConflict) {
    return NextResponse.json({ error: rankConflict }, { status: 400 });
  }

  const tier = await prisma.creatorTier.create({
    data: {
      creatorId: profile.id,
      name,
      description,
      priceCents,
      tierType,
      maxSubscribers,
      isLimited,
    },
  });

  return NextResponse.json({ tier }, { status: 201 });
}
