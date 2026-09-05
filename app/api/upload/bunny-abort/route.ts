import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  deleteBunnyVideo,
  type BunnyUploadAuth,
  verifyBunnyUploadAuthorization,
} from "@/lib/bunny-stream";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as BunnyUploadAuth | null;
  if (
    !body ||
    typeof body.videoId !== "string" ||
    typeof body.libraryId !== "string" ||
    typeof body.authorizationExpire !== "number" ||
    typeof body.authorizationSignature !== "string" ||
    !verifyBunnyUploadAuthorization(body)
  ) {
    return NextResponse.json({ error: "Invalid upload authorization" }, { status: 403 });
  }

  try {
    await deleteBunnyVideo(body.videoId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[upload/bunny-abort] failed", error);
    return NextResponse.json({ error: "Could not discard the failed upload" }, { status: 502 });
  }
}
