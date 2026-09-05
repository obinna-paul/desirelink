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
  const res = await fetch(`${API_BASE}/library/${libraryId()}/videos`, {
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

/**
 * Signs a one-time TUS upload authorization for videoId without ever sending the API key
 * itself to the browser - the signature is SHA256(libraryId + apiKey + expire + videoId),
 * exactly as Bunny's pre-signed upload scheme expects, and the client hands this (not
 * the key) to tus-js-client. Valid for six hours: it is still scoped to this one video,
 * but does not expire halfway through a large upload on slow mobile data.
 */
export function signBunnyUpload(videoId: string): BunnyUploadAuth {
  const authorizationExpire = Math.floor(Date.now() / 1000) + 6 * 60 * 60;
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

export type BunnyVideoStatus = {
  state: "processing" | "ready" | "failed";
  ready: boolean;
  /** Bunny's own 0-100 transcode progress, clamped and defaulted to 0 - lets a caller show
   * a real meter while waiting instead of an indeterminate spinner. */
  encodeProgress: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  error: string | null;
};

/**
 * Polls a video's processing status. `ready` is true once EITHER encodeProgress reaches
 * 100 OR status reports Bunny's numeric "Finished" state (4, per Bunny's own status
 * enum ordering: Created/Uploaded/Processing/Transcoding/Finished/Error/...) - checking
 * both rather than trusting one exactly, since this environment can't reach bunny.net's
 * docs to confirm the enum value against a live response.
 */
export async function getBunnyVideoStatus(videoId: string): Promise<BunnyVideoStatus> {
  const res = await fetch(`${API_BASE}/library/${libraryId()}/videos/${videoId}`, {
    headers: { AccessKey: apiKey(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Bunny Stream: failed to read video status (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  const data = (await res.json()) as {
    status?: number;
    encodeProgress?: number;
    width?: number;
    height?: number;
    length?: number;
    errorMessage?: string;
  };

  const encodeProgress = Math.min(100, Math.max(0, data.encodeProgress ?? 0));
  const ready = data.status === 4 || encodeProgress >= 100;
  const failed = data.status === 5 || data.status === 6;

  return {
    state: failed ? "failed" : ready ? "ready" : "processing",
    ready,
    encodeProgress,
    width: data.width || null,
    height: data.height || null,
    durationSeconds: data.length || null,
    error: failed
      ? data.errorMessage ||
        (data.status === 6
          ? "Bunny could not receive the complete video. Please retry the upload."
          : "Bunny could not transcode this video. Try another export or file.")
      : null,
  };
}

/** Adaptive-bitrate HLS manifest - what actually gets played, via hls.js on browsers
 * without native HLS support (see components/posts/post-video-player.tsx). */
export function getBunnyPlaybackUrl(videoId: string): string {
  return `https://${cdnHostname()}/${videoId}/playlist.m3u8`;
}

export function getBunnyThumbnailUrl(videoId: string): string {
  return `https://${cdnHostname()}/${videoId}/thumbnail.jpg`;
}
