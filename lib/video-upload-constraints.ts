/**
 * How long a video may be, and how large its file may be.
 *
 * Feed video and premium video are different products. A public post is a clip - the
 * 15-minute cap is what keeps the free feed a feed. Premium is where a creator sells
 * long-form work (a full session, a class, a recorded show), so it gets hours, and the
 * ceilings that go with hours.
 *
 * The byte ceilings exist to bound storage and transcode cost, not to decide what anyone
 * is allowed to film, so each one is set to clear what its duration can actually produce:
 * 4K60 out of an iPhone runs ~600MB a minute, which puts a full-length free clip near 9GB,
 * and a four-hour premium upload at a high 1080p bitrate lands well inside 50GB. Resumable
 * chunked uploads (see lib/client-uploads.ts) are what make files this size survivable on
 * a real connection.
 */
export const MAX_VIDEO_DURATION_SECONDS = 15 * 60;
export const MAX_PREMIUM_VIDEO_DURATION_SECONDS = 4 * 60 * 60;

export const MAX_VIDEO_UPLOAD_BYTES = 12 * 1024 * 1024 * 1024;
export const MAX_PREMIUM_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024 * 1024;

export function maxVideoDurationSecondsFor(allowsPremium: boolean): number {
  return allowsPremium ? MAX_PREMIUM_VIDEO_DURATION_SECONDS : MAX_VIDEO_DURATION_SECONDS;
}

export function maxVideoUploadBytesFor(allowsPremium: boolean): number {
  return allowsPremium ? MAX_PREMIUM_VIDEO_UPLOAD_BYTES : MAX_VIDEO_UPLOAD_BYTES;
}

export function formatVideoUploadSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024 * 1024))}GB`;
}

export function formatMaxVideoUploadSize(): string {
  return formatVideoUploadSize(MAX_VIDEO_UPLOAD_BYTES);
}

/** "15 minutes", "4 hours", "1 hour 30 minutes" - for copy that has to name a limit. */
export function formatVideoDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  return parts.join(" ");
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

/** Above this, the relay's platform-capped chunks would mean thousands of round trips
 * through our own serverless route - an hour of extra upload on a big file. */
const RELAY_PREFERRED_MAX_BYTES = 500 * 1024 * 1024;

/**
 * Mobile Chrome talks directly to Bunny. Other mobile browsers keep the same-origin relay
 * that is already proven on those browsers - but only while the file is small enough for
 * the relay's ~3MB chunks to be a reasonable way to move it. A long premium upload goes
 * direct on any browser, because the relay would need thousands of requests for it. Either
 * path may switch once if its opening TUS handshake cannot transfer a byte, so preferring
 * direct never removes the relay as a fallback.
 */
export function getBunnyUploadTransportOrder(
  userAgent: string,
  isLikelyMobile: boolean,
  fileSizeBytes = 0,
): BunnyUploadTransport[] {
  if (isMobileChromeBrowser(userAgent)) return ["direct", "relay"];
  if (isLikelyMobile && fileSizeBytes <= RELAY_PREFERRED_MAX_BYTES) return ["relay", "direct"];
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

export function checkReportedVideoDuration(
  seconds: number | null | undefined,
  limitSeconds: number = MAX_VIDEO_DURATION_SECONDS,
): {
  withinLimit: boolean;
  durationSeconds: number | undefined;
} {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return { withinLimit: true, durationSeconds: undefined };
  }
  if (seconds > limitSeconds + VIDEO_DURATION_TOLERANCE_SECONDS) {
    return { withinLimit: false, durationSeconds: seconds };
  }
  return { withinLimit: true, durationSeconds: Math.min(seconds, limitSeconds) };
}
