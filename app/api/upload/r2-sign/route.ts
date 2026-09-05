import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createR2UploadUrl, generatePostVideoKey, getR2PublicUrl, isR2Configured } from "@/lib/r2";
import { isAllowedVideoContentType } from "@/lib/security/uploads";

// Same one-purpose-per-(folder,type) shape as app/api/upload/sign - the client only ever
// picks a purpose, never a raw key, and R2 currently only stores one kind of thing.
type UploadPurpose = "post-video";

function isValidPurpose(value: unknown): value is UploadPurpose {
  return value === "post-video";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 storage isn't configured for this deployment." }, { status: 503 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { isSuspended: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.isSuspended) {
    return NextResponse.json({ error: "Your account is suspended from uploading media" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const purpose = body?.purpose;
  const contentType = body?.contentType as string | undefined;

  if (!isValidPurpose(purpose)) {
    return NextResponse.json({ error: "Invalid upload purpose" }, { status: 400 });
  }
  if (!contentType || !isAllowedVideoContentType(contentType)) {
    return NextResponse.json({ error: "Unsupported video format" }, { status: 400 });
  }

  const key = generatePostVideoKey(contentType);
  const uploadUrl = await createR2UploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, publicUrl: getR2PublicUrl(key) }, { status: 200 });
}
