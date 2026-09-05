import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { verifyOtp } from "@/lib/email/otp";
import { sendPasswordChangedEmail } from "@/lib/email/notifications";
import { readJson } from "@/lib/security/request";

export async function POST(req: Request) {
  const body = await readJson(req);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { email, code, password } = parsed.data;

  const result = await verifyOtp(email, "password_reset", code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "No password-based account found for that email" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  await sendPasswordChangedEmail(email);

  return NextResponse.json({ ok: true }, { status: 200 });
}
