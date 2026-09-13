import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { getClientIp, readJson } from "@/lib/security/request";
import { sendOAuthPasswordResetAttemptEmail, sendPasswordResetOtpEmail } from "@/lib/email/notifications";
import { isTurnstileConfigured, verifyTurnstileToken } from "@/lib/turnstile";

/**
 * Always responds ok regardless of whether the email has an account - otherwise this
 * endpoint becomes a way to check which emails are registered on Udala.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email;
  const ip = getClientIp(req);

  if (isTurnstileConfigured() && !(await verifyTurnstileToken(parsed.data.turnstileToken, ip))) {
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
  }

  const ipLimit = checkRateLimit(`forgot-password:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  const emailLimit = checkRateLimit(`forgot-password:email:${email}`, { limit: 5, windowMs: 60 * 60 * 1000 });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    const limit = ipLimit.allowed ? emailLimit : ipLimit;
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    if (user?.passwordHash) {
      await sendPasswordResetOtpEmail(email);
    } else if (user) {
      // No password to reset - this account was created via Google/X. Emailing the
      // owner what to do instead (rather than silently sending nothing) is what turns
      // "I tried forgot password and got no code" into something fixable, without
      // revealing anything to a stranger: only the inbox's real owner ever sees it.
      const accounts = await prisma.account.findMany({ where: { userId: user.id }, select: { provider: true } });
      await sendOAuthPasswordResetAttemptEmail(
        email,
        accounts.map((account) => account.provider),
      );
    }
  } catch (error) {
    console.error("[forgot-password] failed to process request", error);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
