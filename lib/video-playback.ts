export function isHlsVideoSource(src: string): boolean {
  return /\.m3u8(?:$|[?#])/i.test(src);
}

/** Bunny Stream keeps the generated poster beside its HLS manifest. A poster gives
 * mobile browsers a stable visual while the manifest and first media segment load. */
export function getVideoPosterUrl(src: string): string | undefined {
  if (!isHlsVideoSource(src)) return undefined;

  try {
    const url = new URL(src);
    url.pathname = url.pathname.replace(/\/playlist\.m3u8$/i, "/thumbnail.jpg");
    return url.toString();
  } catch {
    return src.replace(/\/playlist\.m3u8(?=($|[?#]))/i, "/thumbnail.jpg");
  }
}

export type VideoTapZone = "backward" | "center" | "forward";

export function getVideoTapZone(
  clientX: number,
  frame: Pick<DOMRect, "left" | "width">,
): VideoTapZone {
  if (frame.width <= 0) return "center";
  const position = (clientX - frame.left) / frame.width;
  if (position <= 0.3) return "backward";
  if (position >= 0.7) return "forward";
  return "center";
}

/**
 * "0:07", "3:41", "1:02:05" - the format a scrub bar's time readout needs. Switches to
 * an hours segment only once the video actually runs that long, which now happens for
 * real: premium posts can run up to 4 hours (see lib/video-upload-constraints.ts), where
 * a bare minutes:seconds readout would show a meaningless "142:07".
 */
export function formatPlaybackTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";

  const whole = Math.floor(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}

/** Where along a 0-1 scrub track a pointer landed, clamped so a drag that overshoots the
 * track's edges (a finger sliding off-screen mid-gesture) still resolves to the start or
 * end of the video rather than an out-of-range value. */
export function scrubFractionFromPointer(
  clientX: number,
  track: Pick<DOMRect, "left" | "width">,
): number {
  if (track.width <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - track.left) / track.width));
}

/**
 * A Bunny Stream video's manifest does not exist until the encoder has written its first
 * rendition. That gap is normal and short, and it is deliberately not something a creator
 * waits through before posting (see lib/client-uploads.ts) - so a player that meets a
 * missing manifest is looking at a video that is still being prepared, not a broken one.
 *
 * 404 and 403 are the two answers a CDN gives for "nothing published at this path yet".
 * Anything else - a 500, a DNS failure, a malformed playlist - is a real error and says so.
 */
export function isVideoNotPublishedYet(status: number | undefined | null): boolean {
  return status === 404 || status === 403;
}

/** Probes a manifest the player could not load, to tell "still encoding" apart from
 * "genuinely broken". A request that cannot run at all (offline, a pull zone that refuses
 * cross-origin reads) returns null: unknown, so the caller keeps its own verdict. */
export async function probeVideoManifest(src: string): Promise<number | null> {
  try {
    const res = await fetch(src, { cache: "no-store" });
    return res.status;
  } catch {
    return null;
  }
}

/** How long to wait before looking again for a newly uploaded playlist. Bunny Premium
 * Encoding/JIT usually makes it playable within seconds, so the early checks stay close
 * enough to notice that promptly; only a genuinely longer encode backs off toward twenty
 * seconds so it is not polled hard for minutes. */
export function videoProcessingRetryDelayMs(attempt: number): number {
  const delays = [750, 1_000, 1_500, 2_000, 3_000, 5_000, 7_500, 10_000, 15_000, 20_000];
  return delays[Math.min(attempt, delays.length - 1)];
}
