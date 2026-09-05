import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addEmailRequestSchema } from "@/lib/validations/auth";
import { isPlaceholderEmail } from "@/lib/oauth-placeholder-email";
import { sendAddEmailOtp } from "@/lib/email/notifications";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request";

/**
 * Sends a confirmation code to a real email address for an account created without one
 * (an X/Twitter sign-in - see lib/oauth-placeholder-email.ts). Only reached from
 * /onboarding/email, which itself only renders while Profile.emailChosen is false.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(req);
  const parsed = addEmailRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" },
      { status: 400 }
    );
  }

  const email = parsed.data.email;
  if (isPlaceholderEmail(email)) {
    return NextResponse.json({ error: "Enter a real email address" }, { status: 400 });
  }

  const limit = checkRateLimit(`add-email-request:${session.user.id}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  await sendAddEmailOtp(email);

  return NextResponse.json({ ok: true }, { status: 200 });
}
