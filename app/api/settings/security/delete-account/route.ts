import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteOwnAccountSchema } from "@/lib/validations/auth";
import { readJson } from "@/lib/security/request";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { deleteOwnAccount } from "@/lib/account-deletion";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`delete-account:${session.user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const body = await readJson(req);
  const parsed = deleteOwnAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, profile: { select: { username: true } } },
  });
  if (!user?.profile) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (parsed.data.confirmUsername !== user.profile.username.toLowerCase()) {
    return NextResponse.json({ error: "That username doesn't match your account" }, { status: 400 });
  }

  if (user.passwordHash) {
    if (!parsed.data.password) {
      return NextResponse.json({ error: "Enter your password" }, { status: 400 });
    }
    const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!matches) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
    }
  }

  const result = await deleteOwnAccount(session.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
