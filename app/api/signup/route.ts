import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validations/auth";
import { generateUniqueUsername } from "@/lib/username";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { getClientIp, readJson } from "@/lib/security/request";

export async function POST(req: Request) {
  const body = await readJson(req);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, email, password, profileType } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`signup:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  const emailLimit = checkRateLimit(`signup:email:${normalizedEmail}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    const limit = ipLimit.allowed ? emailLimit : ipLimit;
    return NextResponse.json(
      { error: "Too many signup attempts. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const username = await generateUniqueUsername(normalizedEmail);

    await prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        passwordHash,
        profile: {
          create: {
            username,
            displayName: name,
            bio: "",
            avatarUrl: "",
            gender: "unspecified",
            orientation: "unspecified",
            locationLat: 0,
            locationLng: 0,
            city: "",
            country: "",
            profileType,
          },
        },
      },
    });
  } catch (error) {
    console.error("[signup] account creation failed", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Unable to create account. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
