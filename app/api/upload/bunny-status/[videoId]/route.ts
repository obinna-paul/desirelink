import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getBunnyPlaybackUrl, getBunnyThumbnailUrl, getBunnyVideoStatus } from "@/lib/bunny-stream";

/** Polled by the composer while a just-uploaded video transcodes - see
 * uploadVideoDirect in lib/client-uploads.ts. */
export async function GET(req: Request, { params }: { params: { videoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getBunnyVideoStatus(params.videoId);
    if (status.state === "failed") {
      return NextResponse.json(
        { ready: false, state: "failed", encodeProgress: status.encodeProgress, error: status.error },
        { status: 200 },
      );
    }

    if (!status.ready) {
      return NextResponse.json(
        { ready: false, state: "processing", encodeProgress: status.encodeProgress },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ready: true,
        state: "ready",
        url: getBunnyPlaybackUrl(params.videoId),
        thumbnailUrl: getBunnyThumbnailUrl(params.videoId),
        width: status.width,
        height: status.height,
        durationSeconds: status.durationSeconds,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[upload/bunny-status] status lookup failed", error);
    return NextResponse.json(
      { error: "Video processing status is temporarily unavailable." },
      { status: 502 },
    );
  }
}
