import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  classifyBunnyVideoUploadState,
  getBunnyVideoUploadState,
  type BunnyUploadAuth,
  verifyBunnyUploadAuthorization,
} from "@/lib/bunny-stream";

/**
 * Reconciles an ambiguous browser result with Bunny's source of truth. The signed upload
 * authorization scopes this lookup to the exact video the current session was allowed to
 * upload, so this cannot be used to enumerate another creator's library.
 */
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
    const video = await getBunnyVideoUploadState(body.videoId);
    return NextResponse.json({
      result: classifyBunnyVideoUploadState(video),
      status: video.status,
      storageSize: video.storageSize,
      encodeProgress: video.encodeProgress,
      availableResolutions: video.availableResolutions,
    });
  } catch (error) {
    console.error("[upload/bunny-status] failed", error);
    return NextResponse.json({ error: "Could not confirm the video upload" }, { status: 502 });
  }
}
