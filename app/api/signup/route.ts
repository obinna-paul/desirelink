import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validations/auth";
import { generateUniqueUsername } from "@/lib/username";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const username = await generateUniqueUsername(email);

  await prisma.user.create({
    data: {
      email,
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
        },
      },
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
