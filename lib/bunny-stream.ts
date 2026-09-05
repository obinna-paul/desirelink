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
    process.env.BUNNY_STREAM_LIBRARY_ID && process.env.BUNNY_STREAM_API_KEY && process.env.BUNNY_STREAM_CDN_HOSTNAME
  );
}

function libraryId(): string {
  return process.env.BUNNY_STREAM_LIBRARY_ID!;
}
function apiKey(): string {
  return process.env.BUNNY_STREAM_API_KEY!;
}
function cdnHostname(): string {
  return process.env.BUNNY_STREAM_CDN_HOSTNAME!;
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
    throw new Error(`Bunny Stream: failed to create video (${res.status})`);
  }
  const data = (await res.json()) as { guid: string };
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
 * the key) to tus-js-client. Valid for an hour - long enough for a slow mobile upload,
 * short enough that a leaked signature isn't useful for long.
 */
export function signBunnyUpload(videoId: string): BunnyUploadAuth {
  const authorizationExpire = Math.floor(Date.now() / 1000) + 60 * 60;
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
  ready: boolean;
  /** Bunny's own 0-100 transcode progress, clamped and defaulted to 0 - lets a caller show
   * a real meter while waiting instead of an indeterminate spinner. */
  encodeProgress: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
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
  });
  if (!res.ok) {
    return { ready: false, encodeProgress: 0, width: null, height: null, durationSeconds: null };
  }

  const data = (await res.json()) as {
    status?: number;
    encodeProgress?: number;
    width?: number;
    height?: number;
    length?: number;
  };

  const encodeProgress = Math.min(100, Math.max(0, data.encodeProgress ?? 0));
  const ready = data.status === 4 || encodeProgress >= 100;

  return {
    ready,
    encodeProgress,
    width: data.width || null,
    height: data.height || null,
    durationSeconds: data.length || null,
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
