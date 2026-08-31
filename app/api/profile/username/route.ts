import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUsernameAvailable, normalizeUsername } from "@/lib/username";
import { usernameFieldSchema } from "@/lib/validations/auth";
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
  const parsed = usernameFieldSchema.safeParse((body as { username?: unknown } | null)?.username);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid username" },
      { status: 400 }
    );
  }

  const username = normalizeUsername(parsed.data);

  if (!(await isUsernameAvailable(username, currentProfile.id))) {
    return NextResponse.json({ error: "That username is taken" }, { status: 409 });
  }

  try {
    await prisma.profile.update({
      where: { userId: session.user.id },
      data: { username, usernameChosen: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That username is taken" }, { status: 409 });
    }
    console.error("[profile/username] update failed", error);
    return NextResponse.json({ error: "Couldn't save your username. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
