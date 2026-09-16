/**
 * The ceiling exists to bound storage and transcode cost, not to decide what a creator is
 * allowed to film - MAX_VIDEO_DURATION_SECONDS already does that. It has to clear what a
 * modern phone actually produces within that duration: 4K60 out of an iPhone runs around
 * 600MB per minute, so a full-length 15-minute clip is ~9GB, and the old 2GB ceiling
 * rejected it on selection no matter how patient the person was willing to be. Resumable
 * chunked uploads (see lib/client-uploads.ts) are what make a file this size survivable on
 * a real connection.
 */
export const MAX_VIDEO_UPLOAD_BYTES = 12 * 1024 * 1024 * 1024;

export function formatMaxVideoUploadSize(): string {
  return `${Math.round(MAX_VIDEO_UPLOAD_BYTES / (1024 * 1024 * 1024))}GB`;
}

/**
 * How much of the file goes up in a single resumable request.
 *
 * Two forces pull against each other. Small chunks survive a weak signal (an interrupted
 * chunk is the only thing re-sent, and the server-acknowledged offset is what a resume
 * starts from), but a fixed small chunk turns a very large file into thousands of round
 * trips, each with its own latency and its own chance to fail. So the chunk scales with
 * the file: a phone clip keeps the small, resilient chunks it has always used, while a
 * multi-gigabyte export is cut into a few hundred larger ones instead of thousands.
 *
 * The relay transport is exempt - it goes through our own serverless route, whose request
 * body is capped at ~4.5MB by the platform.
 */
const BUNNY_MIN_CHUNK_BYTES = 5 * 1024 * 1024;
const BUNNY_MAX_CHUNK_BYTES = 20 * 1024 * 1024;
const BUNNY_MOBILE_MAX_CHUNK_BYTES = 8 * 1024 * 1024;
/** Aim for a few hundred chunks whatever the size. */
const BUNNY_TARGET_CHUNK_COUNT = 400;

export function bunnyDirectChunkSizeBytes(fileSizeBytes: number, isMobile: boolean): number {
  const ceiling = isMobile ? BUNNY_MOBILE_MAX_CHUNK_BYTES : BUNNY_MAX_CHUNK_BYTES;
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) return BUNNY_MIN_CHUNK_BYTES;
  return Math.min(
    ceiling,
    Math.max(BUNNY_MIN_CHUNK_BYTES, Math.ceil(fileSizeBytes / BUNNY_TARGET_CHUNK_COUNT)),
  );
}
export const MAX_VIDEO_DURATION_SECONDS = 15 * 60;

export type BunnyUploadTransport = "direct" | "relay";

const VIDEO_TYPES_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  webm: "video/webm",
  avi: "video/x-msvideo",
  vod: "video/mpeg",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
  ts: "video/mp2t",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
  amv: "video/x-amv",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
};

export const VIDEO_UPLOAD_ACCEPT = [
  "video/*",
  ...Object.keys(VIDEO_TYPES_BY_EXTENSION).map((extension) => `.${extension}`),
].join(",");

export function inferVideoContentType(fileName: string, suppliedType?: string | null) {
  const normalizedType = suppliedType?.split(";", 1)[0]?.trim().toLowerCase();
  if (normalizedType?.startsWith("video/")) return normalizedType;

  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? VIDEO_TYPES_BY_EXTENSION[extension] ?? null : null;
}

export function isMobileChromeBrowser(userAgent: string) {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const isChrome = /(?:Chrome|CriOS)\/[\d.]+/i.test(userAgent);
  const isAnotherChromiumBrowser =
    /EdgA|EdgiOS|OPR|OPiOS|Opera Mini|SamsungBrowser|YaBrowser|DuckDuckGo/i.test(
      userAgent,
    );

  return isMobile && isChrome && !isAnotherChromiumBrowser;
}

/**
 * Mobile Chrome talks directly to Bunny. Other mobile browsers keep the same-origin relay
 * that is already proven on those browsers. Either path may switch once if its opening TUS
 * handshake cannot transfer a byte.
 */
export function getBunnyUploadTransportOrder(
  userAgent: string,
  isLikelyMobile: boolean,
): BunnyUploadTransport[] {
  if (isMobileChromeBrowser(userAgent)) return ["direct", "relay"];
  if (isLikelyMobile) return ["relay", "direct"];
  return ["direct", "relay"];
}

/**
 * A browser and a transcoder rarely agree to the second on how long a file is: the
 * `<video>` element reads the container header, Bunny measures the decoded stream. A clip
 * the composer accepted at 14:59.8 can come back from Bunny as 15:00.2, and rejecting it
 * there throws away an upload that already succeeded - on a large file, half an hour of
 * someone's data. Allow that much drift and record the capped value.
 */
export const VIDEO_DURATION_TOLERANCE_SECONDS = 5;

export function checkReportedVideoDuration(seconds: number | null | undefined): {
  withinLimit: boolean;
  durationSeconds: number | undefined;
} {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return { withinLimit: true, durationSeconds: undefined };
  }
  if (seconds > MAX_VIDEO_DURATION_SECONDS + VIDEO_DURATION_TOLERANCE_SECONDS) {
    return { withinLimit: false, durationSeconds: seconds };
  }
  return { withinLimit: true, durationSeconds: Math.min(seconds, MAX_VIDEO_DURATION_SECONDS) };
}

/**
 * How long the composer is willing to wait for Bunny to make an uploaded video playable,
 * and how often it asks.
 *
 * A fixed ceiling is the wrong shape here: a 20MB phone clip is playable in seconds, while
 * a multi-gigabyte export can sit in Bunny's queue and then encode for far longer than any
 * single number a developer would pick. The budget therefore scales with the file, and the
 * stall timeout - not the budget - is what actually ends a hopeless wait: as long as Bunny
 * keeps reporting forward movement, waiting is the correct thing to do.
 */
const PROCESSING_BASE_BUDGET_MS = 30 * 60 * 1000;
const PROCESSING_BUDGET_PER_GB_MS = 20 * 60 * 1000;
const PROCESSING_MAX_BUDGET_MS = 3 * 60 * 60 * 1000;

/** No change in Bunny's reported state or progress for this long means something is wrong
 * on their side; nothing else the client can do will move it. */
export const PROCESSING_STALL_TIMEOUT_MS = 15 * 60 * 1000;

export function videoProcessingBudgetMs(fileSizeBytes: number): number {
  const gigabytes =
    Number.isFinite(fileSizeBytes) && fileSizeBytes > 0
      ? fileSizeBytes / (1024 * 1024 * 1024)
      : 0;
  return Math.min(
    PROCESSING_MAX_BUDGET_MS,
    PROCESSING_BASE_BUDGET_MS + gigabytes * PROCESSING_BUDGET_PER_GB_MS,
  );
}

/** Tight while the interesting transitions happen, then slower - an hour-long transcode
 * shouldn't cost a poll every three seconds. */
export function videoProcessingPollIntervalMs(elapsedMs: number): number {
  if (elapsedMs < 60 * 1000) return 2_000;
  if (elapsedMs < 10 * 60 * 1000) return 5_000;
  return 15_000;
}
