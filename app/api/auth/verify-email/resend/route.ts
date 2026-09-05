import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { sendResendOtpEmail } from "@/lib/email/notifications";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Log in first" }, { status: 401 });
  }

  const email = session.user.email.toLowerCase();
  const limit = checkRateLimit(`otp-resend:${email}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  await sendResendOtpEmail(email);
  return NextResponse.json({ ok: true }, { status: 200 });
}
