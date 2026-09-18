import "server-only";

import crypto from "node:crypto";

/**
 * Bunny Stream replaces R2 as the destination for feed-post video (see lib/r2.ts's doc
 * comment for the earlier reasoning - that still explains why video and images are
 * treated differently, just swap "R2" for "Bunny Stream"). R2 stores raw bytes; Bunny
 * actually transcodes every upload into multiple resolutions and serves it back as
 * adaptive-bitrate HLS, which is what fixes two real problems at once: a video whose
 * source codec a given viewer's browser can't decode, and a viewer on slow mobile data
 * buffering on a full-resolution original instead of getting a lower-bitrate rendition
 * automatically. R2 stays configured and harmless if unused elsewhere.
 */

const API_BASE = "https://video.bunnycdn.com";
export const BUNNY_TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";
const BUNNY_CONTROL_REQUEST_TIMEOUT_MS = 20_000;

async function bunnyFetch(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BUNNY_CONTROL_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isBunnyStreamConfigured(): boolean {
  return Boolean(
    process.env.BUNNY_STREAM_LIBRARY_ID?.trim() &&
      process.env.BUNNY_STREAM_API_KEY?.trim() &&
      process.env.BUNNY_STREAM_CDN_HOSTNAME?.trim()
  );
}

function libraryId(): string {
  return process.env.BUNNY_STREAM_LIBRARY_ID!.trim();
}
function apiKey(): string {
  return process.env.BUNNY_STREAM_API_KEY!.trim();
}
function cdnHostname(): string {
  return process.env.BUNNY_STREAM_CDN_HOSTNAME!
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

/** Creates the empty video object Bunny needs before any bytes can be uploaded to it,
 * returning its guid (videoId). This call carries the API key, so it only ever runs
 * server-side - the client never sees it. */
export async function createBunnyVideo(title: string): Promise<string> {
  const res = await bunnyFetch(`${API_BASE}/library/${libraryId()}/videos`, {
    method: "POST",
    headers: { AccessKey: apiKey(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Bunny Stream: failed to create video (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  const data = (await res.json()) as { guid?: string };
  if (!data.guid) throw new Error("Bunny Stream: create video response did not include a video id");
  return data.guid;
}

export type BunnyUploadAuth = {
  tusEndpoint: string;
  libraryId: string;
  videoId: string;
  authorizationSignature: string;
  authorizationExpire: number;
};

const UPLOAD_WINDOW_BASE_SECONDS = 24 * 60 * 60;
const UPLOAD_WINDOW_PER_GB_SECONDS = 5 * 60 * 60;
const UPLOAD_WINDOW_MAX_SECONDS = 14 * 24 * 60 * 60;

/**
 * Signs a one-time TUS upload authorization for videoId without ever sending the API key
 * itself to the browser - the signature is SHA256(libraryId + apiKey + expire + videoId),
 * exactly as Bunny's pre-signed upload scheme expects, and the client hands this (not
 * the key) to tus-js-client.
 *
 * The window starts at a day and grows with the file, up to two weeks. The token stays
 * scoped to this one video whatever its length. A 50GB premium upload can take several
 * days on a slow uplink; expiring its authorization mid-transfer would strand an upload
 * that TUS could otherwise keep resuming safely.
 */
export function signBunnyUpload(videoId: string, fileSizeBytes = 0): BunnyUploadAuth {
  const gigabytes =
    Number.isFinite(fileSizeBytes) && fileSizeBytes > 0
      ? fileSizeBytes / (1024 * 1024 * 1024)
      : 0;
  const windowSeconds = Math.min(
    UPLOAD_WINDOW_MAX_SECONDS,
    Math.round(UPLOAD_WINDOW_BASE_SECONDS + gigabytes * UPLOAD_WINDOW_PER_GB_SECONDS),
  );
  const authorizationExpire = Math.floor(Date.now() / 1000) + windowSeconds;
  const authorizationSignature = crypto
    .createHash("sha256")
    .update(`${libraryId()}${apiKey()}${authorizationExpire}${videoId}`)
    .digest("hex");

  return {
    tusEndpoint: BUNNY_TUS_ENDPOINT,
    libraryId: libraryId(),
    videoId,
    authorizationSignature,
    authorizationExpire,
  };
}

export function verifyBunnyUploadAuthorization(auth: BunnyUploadAuth): boolean {
  if (auth.libraryId !== libraryId() || auth.authorizationExpire < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = crypto
    .createHash("sha256")
    .update(`${auth.libraryId}${apiKey()}${auth.authorizationExpire}${auth.videoId}`)
    .digest("hex");
  const supplied = Buffer.from(auth.authorizationSignature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer);
}

export async function deleteBunnyVideo(videoId: string): Promise<void> {
  const res = await bunnyFetch(`${API_BASE}/library/${libraryId()}/videos/${videoId}`, {
    method: "DELETE",
    headers: { AccessKey: apiKey(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Bunny Stream: failed to discard video (${res.status})${detail ? `: ${detail}` : ""}`);
  }
}

export type BunnyVideoUploadState = {
  status: number;
  storageSize: number;
  hasOriginal: boolean;
  encodeProgress: number;
  availableResolutions: string | null;
};

/**
 * Reads Bunny's authoritative state for a video after an ambiguous browser-side TUS
 * result. A mobile connection can deliver the final chunk and lose only the response;
 * in that case the dashboard already has the video even though tus-js-client saw an
 * error. The app must ask Bunny before telling the creator that the upload failed.
 */
export async function getBunnyVideoUploadState(videoId: string): Promise<BunnyVideoUploadState> {
  const res = await bunnyFetch(`${API_BASE}/library/${libraryId()}/videos/${videoId}`, {
    method: "GET",
    headers: { AccessKey: apiKey(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(
      `Bunny Stream: failed to confirm video (${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  const data = (await res.json()) as {
    status?: unknown;
    storageSize?: unknown;
    hasOriginal?: unknown;
    encodeProgress?: unknown;
    availableResolutions?: unknown;
  };
  return {
    status: typeof data.status === "number" ? data.status : 0,
    storageSize: typeof data.storageSize === "number" ? data.storageSize : 0,
    hasOriginal: data.hasOriginal === true,
    encodeProgress: typeof data.encodeProgress === "number" ? data.encodeProgress : 0,
    availableResolutions:
      typeof data.availableResolutions === "string"
        ? data.availableResolutions
        : null,
  };
}

export type BunnyVideoReadiness =
  | "playable"
  | "processing"
  | "failed"
  | "incomplete";

/**
 * Distinguishes "Bunny has the source" from "a viewer can play it". That difference is
 * critical with JIT encoding: a video may have the original and a non-zero status while
 * its HLS manifest still returns 404. `availableResolutions` is the first authoritative
 * evidence that Bunny produced a rendition; status 4 and JIT status 8 both expose it.
 *
 * Statuses 5 and 6 are Bunny's explicit processing/upload failures. Other non-zero states
 * (including the JIT pre-processing states) are still processing until a rendition exists.
 * `storageSize` alone is deliberately not enough because a partial TUS object has bytes.
 */
export function classifyBunnyVideoUploadState(
  video: BunnyVideoUploadState,
): BunnyVideoReadiness {
  if (video.status === 5 || video.status === 6) return "failed";
  if (video.availableResolutions?.trim()) return "playable";
  if (video.status > 0 || video.hasOriginal) return "processing";
  return "incomplete";
}

/** Returns a Bunny video id only for a playback URL belonging to this deployment's CDN. */
export function getBunnyVideoIdFromPlaybackUrl(url: string): string | null {
  if (!isBunnyStreamConfigured()) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== cdnHostname()) return null;
    const match = parsed.pathname.match(
      /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8$/i,
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Adaptive-bitrate HLS manifest - what actually gets played, via hls.js on browsers
 * without native HLS support (see components/posts/post-video-player.tsx). */
export function getBunnyPlaybackUrl(videoId: string): string {
  return `https://${cdnHostname()}/${videoId}/playlist.m3u8`;
}

