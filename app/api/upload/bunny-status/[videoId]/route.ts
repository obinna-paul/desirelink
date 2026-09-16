import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getBunnyPlaybackUrl, getBunnyThumbnailUrl, getBunnyVideoStatus } from "@/lib/bunny-stream";

export const dynamic = "force-dynamic";

/** Polled by the composer while a just-uploaded video transcodes - see
 * uploadVideoDirect in lib/client-uploads.ts. Playback details come back as soon as the
 * video is *playable* (Bunny has written at least one rendition into the HLS manifest),
 * not only once every quality level is finished: on a long or large video those two
 * moments can be many minutes apart, and waiting for the second one is what used to leave
 * the composer sitting on "Processing video..." indefinitely. `ready` still reports
 * whether the full transcode is done, so the client can tell the difference. */
export async function GET(req: Request, { params }: { params: { videoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getBunnyVideoStatus(params.videoId);
    if (status.state === "failed") {
      return NextResponse.json(
        { ready: false, playable: false, state: "failed", encodeProgress: status.encodeProgress, error: status.error },
        { status: 200 },
      );
    }

    if (!status.playable) {
      return NextResponse.json(
        {
          ready: false,
          playable: false,
          state: "processing",
          stage: status.stage,
          encodeProgress: status.encodeProgress,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ready: status.ready,
        playable: true,
        state: status.state,
        stage: status.stage,
        encodeProgress: status.encodeProgress,
        availableResolutions: status.availableResolutions,
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
      { error: "Video processing status is temporarily unavailable.", retryable: true },
      { status: 502 },
    );
  }
}
