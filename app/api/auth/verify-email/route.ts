import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyEmailSchema } from "@/lib/validations/auth";
import { verifyOtp } from "@/lib/email/otp";
import { sendWelcomeEmail } from "@/lib/email/notifications";
import { readJson } from "@/lib/security/request";

/**
 * Verifies the signup OTP for whoever is currently signed in - the email to check comes
 * from the session, never the request body, so this can't be used to verify an account
 * that isn't yours.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Log in first" }, { status: 401 });
  }

  const body = await readJson(req);
  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid code" }, { status: 400 });
  }

  const email = session.user.email.toLowerCase();
  const result = await verifyOtp(email, "signup", parsed.data.code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailVerified: new Date() },
  });

  await sendWelcomeEmail(session.user.id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
