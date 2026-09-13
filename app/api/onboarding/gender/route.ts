import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chooseGenderSchema } from "@/lib/validations/auth";
import { readJson } from "@/lib/security/request";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!currentProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await readJson(req);
  const parsed = chooseGenderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Select a gender" },
      { status: 400 },
    );
  }

  await prisma.profile.update({
    where: { id: currentProfile.id },
    data: { gender: parsed.data.gender },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
