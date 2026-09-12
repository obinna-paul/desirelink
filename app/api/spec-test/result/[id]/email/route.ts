import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { SPEC_TYPE_READINGS, type SpecTypeKey } from "@/lib/spec-test";
import { sendSpecTestResultEmail } from "@/lib/email/spec-test-notifications";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const consentMarketing = body?.consentMarketing === true;

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  let result;
  try {
    result = await prisma.specTestResult.update({
      where: { id: params.id },
      data: { email, consentMarketing },
      select: { specType: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Result not found." }, { status: 404 });
    }
    console.error("[spec-test] failed to save email for result", params.id, error);
    return NextResponse.json(
      { error: "Something went wrong sending your result. Please try again in a moment." },
      { status: 500 },
    );
  }

  const reading = SPEC_TYPE_READINGS[result.specType as SpecTypeKey];
  if (reading) {
    await sendSpecTestResultEmail(email, reading, params.id);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
