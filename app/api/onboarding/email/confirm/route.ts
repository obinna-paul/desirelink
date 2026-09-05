import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addEmailConfirmSchema } from "@/lib/validations/auth";
import { verifyOtp } from "@/lib/email/otp";
import { readJson } from "@/lib/security/request";

/** Confirms the code sent by /api/onboarding/email/request and finalizes the account's
 * real email - clears Profile.emailChosen so app/(app)/layout.tsx's onboarding redirect
 * stops firing. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(req);
  const parsed = addEmailConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid code" },
      { status: 400 }
    );
  }

  const { email, code } = parsed.data;

  const result = await verifyOtp(email, "add_email", code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { email, emailVerified: new Date() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    console.error("[onboarding/email/confirm] update failed", error);
    return NextResponse.json({ error: "Couldn't save your email. Please try again." }, { status: 500 });
  }

  await prisma.profile.update({
    where: { userId: session.user.id },
    data: { emailChosen: true },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
