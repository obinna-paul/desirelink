import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderEarningsHistory } from "@/lib/rewards/earnings";

export async function GET(_req: Request, { params }: { params: { providerId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (viewerProfile?.id !== params.providerId) {
    return NextResponse.json({ error: "You can only view your own earnings" }, { status: 403 });
  }

  const earnings = await getProviderEarningsHistory(params.providerId);
  return NextResponse.json({ earnings }, { status: 200 });
}
