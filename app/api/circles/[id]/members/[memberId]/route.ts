import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSessionProfile() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  const ownerProfile = await getSessionProfile();
  if (!ownerProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await prisma.circleMember.findFirst({
    where: {
      id: params.memberId,
      circleId: params.id,
      circle: { userId: ownerProfile.id },
    },
    select: { id: true },
  });

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await prisma.circleMember.delete({ where: { id: params.memberId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
