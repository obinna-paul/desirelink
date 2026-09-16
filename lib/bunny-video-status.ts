/**
 * Turns a Bunny Stream video record into an answer to the only question the composer
 * actually has: can this video be played yet?
 *
 * Kept free of `server-only` and of any Bunny credentials so both the API route and the
 * unit tests can use it directly.
 *
 * Bunny's own `status` enum (VideoModelStatus), in order:
 *   0 Created, 1 Uploaded, 2 Processing, 3 Transcoding, 4 Finished, 5 Error,
 *   6 UploadFailed, 7 JitSegmenting, 8 JitPlaylistsCreated
 *
 * Two of those matter more than they look. A library with just-in-time encoding enabled
 * never reaches 4 at all - it settles on 7/8 - so treating "4 or encodeProgress 100" as
 * the only finished state leaves such a video "processing" forever. And 3 (Transcoding)
 * already serves playable HLS for every resolution listed in `availableResolutions`:
 * adaptive bitrate picks up the remaining renditions as they appear, which is what makes
 * a long video usable long before its last quality level is written.
 */

export const BUNNY_VIDEO_STATUS = {
  created: 0,
  uploaded: 1,
  processing: 2,
  transcoding: 3,
  finished: 4,
  error: 5,
  uploadFailed: 6,
  jitSegmenting: 7,
  jitPlaylistsCreated: 8,
} as const;

/** What the person waiting on the composer is actually waiting for right now. */
export type BunnyProcessingStage = "queued" | "encoding" | "finalizing";

export type BunnyVideoStatusPayload = {
  status?: number | null;
  encodeProgress?: number | null;
  width?: number | null;
  height?: number | null;
  length?: number | null;
  availableResolutions?: string | null;
  errorMessage?: string | null;
};

export type BunnyVideoStatus = {
  /** `playable` means at least one rendition is live; `ready` means every one is. */
  state: "processing" | "playable" | "ready" | "failed";
  ready: boolean;
  playable: boolean;
  stage: BunnyProcessingStage;
  /** Bunny's own 0-100 transcode progress, clamped and defaulted to 0. */
  encodeProgress: number;
  availableResolutions: string[];
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  error: string | null;
  rawStatus: number | null;
};

function parseResolutions(value: string | null | undefined): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function bunnyProcessingStage(
  rawStatus: number | null,
  encodeProgress: number,
  playable: boolean,
): BunnyProcessingStage {
  if (playable) return "finalizing";
  if (encodeProgress > 0) return "encoding";
  if (
    rawStatus === BUNNY_VIDEO_STATUS.transcoding ||
    rawStatus === BUNNY_VIDEO_STATUS.jitSegmenting
  ) {
    return "encoding";
  }
  return "queued";
}

export function interpretBunnyVideoStatus(
  data: BunnyVideoStatusPayload,
): BunnyVideoStatus {
  const rawStatus = typeof data.status === "number" ? data.status : null;
  const encodeProgress = Math.min(
    100,
    Math.max(0, typeof data.encodeProgress === "number" ? data.encodeProgress : 0),
  );
  const availableResolutions = parseResolutions(data.availableResolutions);

  const failed =
    rawStatus === BUNNY_VIDEO_STATUS.error || rawStatus === BUNNY_VIDEO_STATUS.uploadFailed;

  const ready =
    !failed &&
    (rawStatus === BUNNY_VIDEO_STATUS.finished ||
      rawStatus === BUNNY_VIDEO_STATUS.jitPlaylistsCreated ||
      encodeProgress >= 100);

  // A rendition that Bunny has already written is in the manifest and plays now - waiting
  // for the rest of them is what used to strand a large video on "Processing video..."
  // long past the point it was watchable.
  const playable =
    ready ||
    (!failed &&
      availableResolutions.length > 0 &&
      (rawStatus === BUNNY_VIDEO_STATUS.transcoding ||
        rawStatus === BUNNY_VIDEO_STATUS.jitSegmenting));

  return {
    state: failed ? "failed" : ready ? "ready" : playable ? "playable" : "processing",
    ready,
    playable,
    stage: bunnyProcessingStage(rawStatus, encodeProgress, playable && !ready),
    encodeProgress,
    availableResolutions,
    width: toNumberOrNull(data.width),
    height: toNumberOrNull(data.height),
    durationSeconds: toNumberOrNull(data.length),
    error: failed
      ? data.errorMessage?.trim() ||
        (rawStatus === BUNNY_VIDEO_STATUS.uploadFailed
          ? "Bunny could not receive the complete video. Please retry the upload."
          : "Bunny could not transcode this video. Try another export or file.")
      : null,
    rawStatus,
  };
}
