/**
 * Remembers the one video that is currently transcoding on Bunny, so the composer can pick
 * the wait back up instead of losing the upload.
 *
 * Transcoding a large file takes as long as it takes - minutes for a phone clip, much
 * longer for a long 4K export. Before this, that whole wait lived in one React state tree:
 * a refresh, a backgrounded mobile tab that the OS discarded, or a tapped-away browser
 * meant the bytes were already safely on Bunny but nothing on this side knew the video id
 * any more. The person saw the upload start over from zero.
 *
 * The record is deliberately tiny (an id and the framing choices already made for it) and
 * short-lived. Every read and write is wrapped: private mode, blocked site data, and a
 * full storage quota must degrade to "no resume", never to a thrown error in the composer.
 */

import { isPostDisplayAspectRatio, type PostDisplayAspectRatio, type VideoCrop } from "@/lib/post-shared";

const STORAGE_KEY = "udala:pending-video-upload";

/** Past this, a record is more likely to be abandoned than still encoding, and resuming it
 * would just re-open a wait nobody is watching for. Comfortably longer than any transcode
 * the 15-minute duration cap can produce. */
const MAX_RECORD_AGE_MS = 6 * 60 * 60 * 1000;

/** How many times the composer may re-enter the wait for the same video before leaving it
 * alone - bounds a video Bunny has genuinely stalled on from re-polling on every mount. */
export const MAX_PENDING_RESUME_ATTEMPTS = 3;

export type PendingVideoUpload = {
  videoId: string;
  fileName: string;
  fileSize: number;
  startedAt: number;
  resumeAttempts: number;
  displayAspectRatio?: PostDisplayAspectRatio;
  crop?: VideoCrop;
};

function isVideoCrop(value: unknown): value is VideoCrop {
  if (!value || typeof value !== "object") return false;
  const crop = value as Record<string, unknown>;
  return (
    typeof crop.zoom === "number" &&
    typeof crop.offsetXFrac === "number" &&
    typeof crop.offsetYFrac === "number"
  );
}

function parse(raw: string | null): PendingVideoUpload | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (typeof record.videoId !== "string" || record.videoId.length === 0) return null;
  if (typeof record.startedAt !== "number" || !Number.isFinite(record.startedAt)) return null;
  if (Date.now() - record.startedAt > MAX_RECORD_AGE_MS) return null;

  const resumeAttempts =
    typeof record.resumeAttempts === "number" && Number.isFinite(record.resumeAttempts)
      ? Math.max(0, Math.floor(record.resumeAttempts))
      : 0;
  if (resumeAttempts >= MAX_PENDING_RESUME_ATTEMPTS) return null;

  return {
    videoId: record.videoId,
    fileName: typeof record.fileName === "string" ? record.fileName : "Your video",
    fileSize:
      typeof record.fileSize === "number" && Number.isFinite(record.fileSize) && record.fileSize > 0
        ? record.fileSize
        : 0,
    startedAt: record.startedAt,
    resumeAttempts,
    displayAspectRatio: isPostDisplayAspectRatio(record.displayAspectRatio)
      ? record.displayAspectRatio
      : undefined,
    crop: isVideoCrop(record.crop) ? record.crop : undefined,
  };
}

export function readPendingVideoUpload(): PendingVideoUpload | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }

  const record = parse(raw);
  // A record that no longer qualifies (expired, malformed, out of attempts) is dropped
  // rather than left to be re-parsed and re-rejected on every composer mount.
  if (!record && raw) clearPendingVideoUpload();
  return record;
}

export function savePendingVideoUpload(
  record: Omit<PendingVideoUpload, "startedAt" | "resumeAttempts"> &
    Partial<Pick<PendingVideoUpload, "startedAt" | "resumeAttempts">>,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...record,
        startedAt: record.startedAt ?? Date.now(),
        resumeAttempts: record.resumeAttempts ?? 0,
      }),
    );
  } catch {
    // Storage is unavailable or full - resuming is a recovery path, not a requirement.
  }
}

/** Counts one resume attempt against the record, so a video Bunny never finishes stops
 * being re-polled after a few tries. Returns the record as it now stands. */
export function markPendingVideoResumeAttempt(
  record: PendingVideoUpload,
): PendingVideoUpload {
  const updated = { ...record, resumeAttempts: record.resumeAttempts + 1 };
  savePendingVideoUpload(updated);
  return updated;
}

export function clearPendingVideoUpload(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do - a stale record expires on its own.
  }
}
