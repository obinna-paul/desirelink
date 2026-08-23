import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveDesiresSchema } from "@/lib/validations/desire";

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

  const desires = await prisma.desire.findMany({
    where: { userId: profile.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ desires }, { status: 200 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = saveDesiresSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { desires } = parsed.data;

  await prisma.$transaction([
    prisma.desire.deleteMany({ where: { userId: profile.id } }),
    ...(desires.length > 0
      ? [
          prisma.desire.createMany({
            data: desires.map((desire) => ({
              userId: profile.id,
              category: desire.category,
              level: desire.level,
              privacy: desire.privacy,
            })),
          }),
        ]
      : []),
  ]);

  const saved = await prisma.desire.findMany({
    where: { userId: profile.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ desires: saved }, { status: 200 });
}
