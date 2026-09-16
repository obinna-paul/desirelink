import "server-only";

import crypto from "node:crypto";

import {
  interpretBunnyVideoStatus,
  type BunnyVideoStatus as BunnyVideoStatusResult,
  type BunnyVideoStatusPayload,
} from "@/lib/bunny-video-status";

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

export type { BunnyVideoStatus } from "@/lib/bunny-video-status";

/**
 * Reads a video's processing status. The interpretation - in particular what counts as
 * playable versus fully transcoded - lives in lib/bunny-video-status.ts, which documents
 * Bunny's status enum and is unit-tested on its own.
 */
export async function getBunnyVideoStatus(videoId: string): Promise<BunnyVideoStatusResult> {
  const res = await fetch(`${API_BASE}/library/${libraryId()}/videos/${videoId}`, {
    headers: { AccessKey: apiKey(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Bunny Stream: failed to read video status (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  return interpretBunnyVideoStatus((await res.json()) as BunnyVideoStatusPayload);
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
  const res = await fetch(`${API_BASE}/library/${libraryId()}/videos/${videoId}`, {
    method: "DELETE",
    headers: { AccessKey: apiKey(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Bunny Stream: failed to discard video (${res.status})${detail ? `: ${detail}` : ""}`);
  }
}

/** Adaptive-bitrate HLS manifest - what actually gets played, via hls.js on browsers
 * without native HLS support (see components/posts/post-video-player.tsx). */
export function getBunnyPlaybackUrl(videoId: string): string {
  return `https://${cdnHostname()}/${videoId}/playlist.m3u8`;
}

export function getBunnyThumbnailUrl(videoId: string): string {
  return `https://${cdnHostname()}/${videoId}/thumbnail.jpg`;
}
