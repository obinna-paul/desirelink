import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removePaymentMethod, setDefaultPaymentMethod } from "@/lib/billing";

async function getProfileId(req: Request): Promise<string | null> {
  void req;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  return profile?.id ?? null;
}

export async function DELETE(req: Request, { params }: { params: { cardId: string } }) {
  const profileId = await getProfileId(req);
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await removePaymentMethod(profileId, params.cardId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function PUT(req: Request, { params }: { params: { cardId: string } }) {
  const profileId = await getProfileId(req);
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await setDefaultPaymentMethod(profileId, params.cardId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
