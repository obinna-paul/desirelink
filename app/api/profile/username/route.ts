import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUsernameAvailable } from "@/lib/username";
import { normalizeUsername } from "@/lib/username-format";
import { canChangeUsername, getNextUsernameChangeAt } from "@/lib/username-change";
import { usernameFieldSchema } from "@/lib/validations/auth";
import { readJson } from "@/lib/security/request";
import { syncProfileSearchDocument } from "@/lib/search";

function isMissingUsernameAliasTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

function cooldownResponse(lastChangedAt: Date) {
  const nextChangeAt = getNextUsernameChangeAt(lastChangedAt)!;
  return NextResponse.json(
    {
      error: `You can change your username again on ${nextChangeAt.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })}.`,
      code: "USERNAME_CHANGE_COOLDOWN",
      nextChangeAt: nextChangeAt.toISOString(),
    },
    { status: 429 },
  );
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const query = new URL(req.url).searchParams.get("q");
  const parsed = usernameFieldSchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ available: false, error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const username = normalizeUsername(parsed.data);
  return NextResponse.json({ available: await isUsernameAvailable(username, profile.id) });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, username: true, usernameChosen: true },
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

  if (username === currentProfile.username) {
    if (!currentProfile.usernameChosen) {
      const profile = await prisma.profile.update({
        where: { id: currentProfile.id },
        data: { usernameChosen: true },
      });
      await syncProfileSearchDocument(profile).catch((error) => {
        console.warn("[profile/username] failed to refresh search document", error);
      });
    }
    return NextResponse.json({ success: true, username }, { status: 200 });
  }

  let lastChange: { changedAt: Date } | null = null;
  try {
    lastChange = await prisma.usernameAlias.findFirst({
      where: { profileId: currentProfile.id },
      orderBy: { changedAt: "desc" },
      select: { changedAt: true },
    });
  } catch (error) {
    if (isMissingUsernameAliasTable(error)) {
      return NextResponse.json(
        { error: "Username changes are being enabled. Please try again shortly." },
        { status: 503 },
      );
    }
    throw error;
  }

  if (lastChange && !canChangeUsername(lastChange.changedAt)) {
    return cooldownResponse(lastChange.changedAt);
  }

  if (!(await isUsernameAvailable(username, currentProfile.id))) {
    return NextResponse.json({ error: "That username is taken" }, { status: 409 });
  }

  try {
    const changedAt = new Date();
    const profile = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 FROM "Profile" WHERE "id" = ${currentProfile.id} FOR UPDATE`,
      );
      const freshProfile = await tx.profile.findUnique({
        where: { id: currentProfile.id },
        select: { id: true, username: true },
      });
      if (!freshProfile) throw new Error("Profile not found");

      const latestAlias = await tx.usernameAlias.findFirst({
        where: { profileId: freshProfile.id },
        orderBy: { changedAt: "desc" },
        select: { changedAt: true },
      });
      if (latestAlias && !canChangeUsername(latestAlias.changedAt, changedAt)) {
        throw new Error(`USERNAME_CHANGE_COOLDOWN:${latestAlias.changedAt.toISOString()}`);
      }

      const [profileOwner, aliasOwner] = await Promise.all([
        tx.profile.findUnique({ where: { username }, select: { id: true } }),
        tx.usernameAlias.findUnique({ where: { username }, select: { profileId: true } }),
      ]);
      if ((profileOwner && profileOwner.id !== freshProfile.id) || (aliasOwner && aliasOwner.profileId !== freshProfile.id)) {
        throw new Error("USERNAME_TAKEN");
      }

      await tx.usernameAlias.deleteMany({
        where: { username, profileId: freshProfile.id },
      });
      await tx.usernameAlias.upsert({
        where: { username: freshProfile.username },
        create: { profileId: freshProfile.id, username: freshProfile.username, changedAt },
        update: { changedAt },
      });

      return tx.profile.update({
        where: { id: freshProfile.id },
        data: { username, usernameChosen: true },
      });
    });
    await syncProfileSearchDocument(profile).catch((error) => {
      console.warn("[profile/username] failed to refresh search document", error);
    });
  } catch (error) {
    if (isMissingUsernameAliasTable(error)) {
      return NextResponse.json(
        { error: "Username changes are being enabled. Please try again shortly." },
        { status: 503 },
      );
    }
    if (error instanceof Error && error.message.startsWith("USERNAME_CHANGE_COOLDOWN:")) {
      return cooldownResponse(new Date(error.message.slice("USERNAME_CHANGE_COOLDOWN:".length)));
    }
    if (error instanceof Error && error.message === "USERNAME_TAKEN") {
      return NextResponse.json({ error: "That username is taken" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That username is taken" }, { status: 409 });
    }
    console.error("[profile/username] update failed", error);
    return NextResponse.json({ error: "Couldn't save your username. Please try again." }, { status: 500 });
  }

  const nextChangeAt = getNextUsernameChangeAt(new Date())?.toISOString();
  return NextResponse.json({ success: true, username, nextChangeAt }, { status: 200 });
}
