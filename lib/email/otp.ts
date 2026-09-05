import "server-only";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rate-limit";

export type OtpPurpose = "signup" | "password_reset" | "add_email";

const OTP_TTL_MINUTES = Number(process.env.EMAIL_OTP_TTL_MINUTES ?? 10);
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Issues a fresh 6-digit code for email+purpose, invalidating any code already
 * outstanding for that pair so only the most recently sent one can ever be redeemed.
 * Returns the raw code so the caller can email it - only its bcrypt hash is stored.
 */
export async function issueOtp(email: string, purpose: OtpPurpose): Promise<string> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.emailOtp.deleteMany({ where: { email, purpose, consumedAt: null } });
  await prisma.emailOtp.create({ data: { email, purpose, codeHash, expiresAt } });

  return code;
}

export type VerifyOtpResult = { ok: true } | { ok: false; error: string };

/** Verifies a submitted code against the most recent outstanding one for email+purpose.
 * Rate-limited per email+purpose so a code can't be brute-forced, and single-use - a
 * correct code is marked consumed immediately so it can't be replayed. */
export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<VerifyOtpResult> {
  const limit = checkRateLimit(`otp-verify:${email}:${purpose}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    return { ok: false, error: "Too many attempts. Request a new code and try again shortly." };
  }

  const record = await prisma.emailOtp.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, error: "That code is invalid or has expired." };
  if (record.expiresAt < new Date()) return { ok: false, error: "That code has expired. Request a new one." };
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "Too many attempts on that code. Request a new one." };
  }

  const valid = await bcrypt.compare(code, record.codeHash);
  if (!valid) {
    await prisma.emailOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "That code is incorrect." };
  }

  await prisma.emailOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}
