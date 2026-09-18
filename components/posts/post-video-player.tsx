"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";

import type { VideoCrop } from "@/lib/post-shared";
import {
  formatPlaybackTime,
  getVideoPosterUrl,
  getVideoTapZone,
  isHlsVideoSource,
  isVideoNotPublishedYet,
  probeVideoManifest,
  scrubFractionFromPointer,
  videoProcessingRetryDelayMs,
  type VideoTapZone,
} from "@/lib/video-playback";
import { cn } from "@/lib/utils";

type PlaybackState = "loading" | "processing" | "ready" | "playing" | "paused" | "error";
type SeekDirection = Extract<VideoTapZone, "backward" | "forward">;

/** A video posted seconds ago is normal to find still encoding; one that has not appeared
 * after this many checks (a few minutes of backing off) is worth a manual retry instead of
 * an endless poll. */
const MAX_PROCESSING_CHECKS = 40;

const DOUBLE_TAP_WINDOW_MS = 300;
const SEEK_SECONDS = 10;
const SCRUB_KEY_STEP_SECONDS = 5;
const SCRUB_KEY_BIG_STEP_SECONDS = 30;
const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;

export function PostVideoPlayer({
  src,
  fallbackSrc,
  naturalWidth,
  naturalHeight,
  crop,
}: {
  src: string;
  /** Used by the composer when its instant local-file preview cannot be decoded on this
   * device. The Bunny HLS URL remains a transparent fallback, not the first thing the
   * creator has to wait for. */
  fallbackSrc?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  crop?: VideoCrop;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const inViewRef = useRef(false);
  const manuallyPausedRef = useRef(false);
  const mutedRef = useRef(true);
  const hlsManagedRef = useRef(false);
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ time: number; zone: VideoTapZone } | null>(null);
  const tapTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const playbackIconTimerRef = useRef<number | null>(null);
  const scrubTrackRef = useRef<HTMLDivElement>(null);
  const scrubRafRef = useRef<number | null>(null);
  const pendingScrubTimeRef = useRef<number | null>(null);
  const processingChecksRef = useRef(0);
  const processingTimerRef = useRef<number | null>(null);
  const fallbackAttemptedRef = useRef(false);
  const [muted, setMuted] = useState(true);
  const [playbackRate, setPlaybackRate] = useState<(typeof PLAYBACK_RATES)[number]>(1);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [seekFeedback, setSeekFeedback] = useState<SeekDirection | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("loading");
  const [playbackSrc, setPlaybackSrc] = useState(src);
  const [reloadKey, setReloadKey] = useState(0);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  // Duration and buffered progress both stay 0 (never NaN/Infinity, which the browser can
  // briefly report before metadata loads) so every consumer can treat "0" as "unknown yet"
  // without a separate finiteness check.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedFraction, setBufferedFraction] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [isScrubBarHovering, setIsScrubBarHovering] = useState(false);
  const [isScrubBarFocused, setIsScrubBarFocused] = useState(false);
  const hasFramedCrop = Boolean(crop && naturalWidth && naturalHeight);
  const isHls = isHlsVideoSource(playbackSrc);
  const posterUrl = getVideoPosterUrl(playbackSrc);
  const hasDuration = duration > 0;
  const displayTime = isScrubbing ? scrubTime : currentTime;
  const displayFraction = hasDuration ? Math.min(1, Math.max(0, displayTime / duration)) : 0;
  const isScrubBarActive = isScrubbing || isScrubBarHovering || isScrubBarFocused;

  /**
   * Waits out a video that exists but has not been encoded yet, rather than calling it
   * broken. Posting no longer blocks on the encoder, so a clip opened moments after it was
   * published is expected to arrive here first - it just needs another look shortly.
   */
  const waitForProcessingVideo = useCallback(() => {
    if (processingTimerRef.current !== null) return;
    if (processingChecksRef.current >= MAX_PROCESSING_CHECKS) {
      setPlaybackState("error");
      return;
    }

    const delay = videoProcessingRetryDelayMs(processingChecksRef.current);
    processingChecksRef.current += 1;
    setPlaybackState("processing");
    processingTimerRef.current = window.setTimeout(() => {
      processingTimerRef.current = null;
      setReloadKey((current) => current + 1);
    }, delay);
  }, []);

  /** Decides which of the two a failed load was: a video still being encoded, or one that
   * is actually broken. Only the CDN can answer that, so ask it. */
  const handleFailedLoad = useCallback(
    async (knownStatus?: number) => {
      if (
        fallbackSrc &&
        playbackSrc !== fallbackSrc &&
        !fallbackAttemptedRef.current
      ) {
        fallbackAttemptedRef.current = true;
        processingChecksRef.current = 0;
        setPlaybackState("loading");
        setPlaybackSrc(fallbackSrc);
        return;
      }

      const status = knownStatus ?? (await probeVideoManifest(playbackSrc));
      if (isVideoNotPublishedYet(status)) {
        waitForProcessingVideo();
        return;
      }
      setPlaybackState("error");
    },
    [fallbackSrc, playbackSrc, waitForProcessingVideo],
  );

  useEffect(() => {
    fallbackAttemptedRef.current = false;
    processingChecksRef.current = 0;
    setPlaybackSrc(src);
  }, [src]);

  const attemptPlayback = useCallback(async () => {
    const el = videoRef.current;
    if (!el || !inViewRef.current || manuallyPausedRef.current) return;

    el.muted = mutedRef.current;
    try {
      await el.play();
      setPlaybackState("playing");
    } catch {
      // Mobile browsers can reject an early play() call while HLS is attaching. The
      // loaded-data/can-play handlers below try again once an actual frame exists.
      if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setPlaybackState("paused");
      }
    }
  }, []);

  // Some Android browsers report native HLS support even though playback fails. Prefer
  // hls.js wherever MediaSource is available, then fall back to native HLS for Safari.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const video = el;

    setPlaybackState("loading");
    hlsManagedRef.current = false;
    // A reload (new src, or the "Try video again" retry) starts the scrub bar over too -
    // the old duration and position belong to whatever was previously attached.
    setCurrentTime(0);
    setDuration(0);
    setBufferedFraction(0);
    setIsScrubbing(false);

    if (!isHls) return;

    let hls: import("hls.js").default | null = null;
    let cancelled = false;
    let networkRecoveries = 0;
    let mediaRecoveries = 0;

    function attachNativeHls() {
      if (cancelled) return;
      if (!video.canPlayType("application/vnd.apple.mpegurl")) {
        setPlaybackState("error");
        return;
      }
      video.src = playbackSrc;
      video.load();
    }

    function reportHlsFailure(status?: number) {
      if (cancelled) return;
      void handleFailedLoad(status);
    }

    void import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          attachNativeHls();
          return;
        }

        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          maxBufferLength: 30,
        });
        hlsManagedRef.current = true;

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          if (!cancelled) hls?.loadSource(playbackSrc);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          // The encoder got there - stop counting checks so a later, unrelated hiccup
          // starts from a full budget rather than an exhausted one.
          processingChecksRef.current = 0;
          setPlaybackState("ready");
          void attemptPlayback();
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (cancelled || !data.fatal || !hls) return;

          // hls.js hands the HTTP status straight over, so a not-yet-encoded video is
          // recognised here without a second request - and retrying the load on it would
          // only spend this video's recovery budget on a 404 that is meant to be there.
          const status = data.response?.code;
          if (isVideoNotPublishedYet(status)) {
            reportHlsFailure(status);
            return;
          }

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveries < 2) {
            networkRecoveries += 1;
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 1) {
            mediaRecoveries += 1;
            hls.recoverMediaError();
            return;
          }

          reportHlsFailure(status);
        });
        hls.attachMedia(video);
      })
      .catch(() => attachNativeHls());

    return () => {
      cancelled = true;
      hls?.destroy();
      hlsManagedRef.current = false;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [attemptPlayback, handleFailedLoad, isHls, playbackSrc, reloadKey]);

  useEffect(() => {
    if (!hasFramedCrop) return;
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setFrameSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasFramedCrop]);

  // React's `muted` prop only sets the HTML attribute, not the DOM property - some browsers
  // (desktop Chrome among them) require the actual .muted property to be true before allowing
  // autoplay() without a user gesture, and check that property rather than the attribute.
  useEffect(() => {
    const el = videoRef.current;
    mutedRef.current = muted;
    if (el) el.muted = muted;
  }, [muted]);

  useEffect(() => {
    manuallyPausedRef.current = manuallyPaused;
  }, [manuallyPaused]);

  useEffect(() => {
    const el = videoRef.current;
    if (el) el.playbackRate = playbackRate;
  }, [playbackRate, playbackSrc, reloadKey]);

  useEffect(
    () => () => {
      if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
      if (playbackIconTimerRef.current !== null) window.clearTimeout(playbackIconTimerRef.current);
      if (scrubRafRef.current !== null) window.cancelAnimationFrame(scrubRafRef.current);
      if (processingTimerRef.current !== null) window.clearTimeout(processingTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        inViewRef.current = inView;
        if (inView && !manuallyPaused) {
          void attemptPlayback();
        } else {
          el.pause();
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    observer.observe(el);
    return () => {
      inViewRef.current = false;
      observer.disconnect();
    };
  }, [attemptPlayback, manuallyPaused]);

  function togglePlayback() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      manuallyPausedRef.current = false;
      setManuallyPaused(false);
      void el
        .play()
        .then(() => setPlaybackState("playing"))
        .catch(() => setPlaybackState("paused"));
    } else {
      el.pause();
      manuallyPausedRef.current = true;
      setManuallyPaused(true);
      setPlaybackState("paused");
    }
    setShowPauseIcon(true);
    if (playbackIconTimerRef.current !== null) {
      window.clearTimeout(playbackIconTimerRef.current);
    }
    playbackIconTimerRef.current = window.setTimeout(() => setShowPauseIcon(false), 500);
  }

  function seekVideo(direction: SeekDirection) {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.currentTime)) return;
    const delta = direction === "backward" ? -SEEK_SECONDS : SEEK_SECONDS;
    const upperBound = Number.isFinite(el.duration) ? el.duration : Number.POSITIVE_INFINITY;
    const nextTime = Math.max(0, Math.min(upperBound, el.currentTime + delta));
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
    setSeekFeedback(direction);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setSeekFeedback(null), 650);
  }

  /** Reads how far Bunny's HLS delivery has actually buffered around the playhead, not
   * just how far playback has reached - the scrub bar's dimmer fill, so a viewer can see
   * how far they can drag before they'd outrun what's loaded. Recomputed on every
   * `progress`/`timeupdate` tick rather than cached, since `buffered` is a live range the
   * browser can extend or drop without any event of its own. */
  function updateBufferedFraction() {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    const { buffered, currentTime: playhead } = el;
    for (let index = 0; index < buffered.length; index += 1) {
      if (buffered.start(index) <= playhead + 0.25 && playhead <= buffered.end(index)) {
        setBufferedFraction(Math.min(1, buffered.end(index) / el.duration));
        return;
      }
    }
  }

  function timeFromScrubPointer(clientX: number): number {
    const track = scrubTrackRef.current;
    if (!track || duration <= 0) return 0;
    return scrubFractionFromPointer(clientX, track.getBoundingClientRect()) * duration;
  }

  /** Seeking on every pointermove would fire a `currentTime` write - and on HLS, a
   * network request for the new segment - many times a frame during a fast drag. The
   * thumb still tracks the pointer immediately (via `scrubTime`); only the actual seek
   * is coalesced to once per animation frame. */
  function commitScrubTime(time: number) {
    pendingScrubTimeRef.current = time;
    if (scrubRafRef.current !== null) return;
    scrubRafRef.current = window.requestAnimationFrame(() => {
      scrubRafRef.current = null;
      const pending = pendingScrubTimeRef.current;
      pendingScrubTimeRef.current = null;
      const el = videoRef.current;
      if (pending !== null && el) el.currentTime = pending;
    });
  }

  function handleScrubPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (duration <= 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Dragging still works via the element's own move/up handlers without capture -
      // capture only helps it keep tracking a pointer that slides outside the bar.
    }
    const time = timeFromScrubPointer(event.clientX);
    setIsScrubbing(true);
    setScrubTime(time);
    const el = videoRef.current;
    if (el) el.currentTime = time;
  }

  function handleScrubPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isScrubbing) return;
    event.stopPropagation();
    const time = timeFromScrubPointer(event.clientX);
    setScrubTime(time);
    commitScrubTime(time);
  }

  function endScrub(event: React.PointerEvent<HTMLDivElement>) {
    if (!isScrubbing) return;
    event.stopPropagation();
    if (scrubRafRef.current !== null) {
      window.cancelAnimationFrame(scrubRafRef.current);
      scrubRafRef.current = null;
      pendingScrubTimeRef.current = null;
    }
    const time = timeFromScrubPointer(event.clientX);
    setIsScrubbing(false);
    setCurrentTime(time);
    const el = videoRef.current;
    if (el) el.currentTime = time;
    releaseScrubPointerCapture(event);
  }

  /** A pointercancel (an interrupting system gesture, a lost touch) carries coordinates
   * that no longer reflect an intentional drag - stop scrubbing without treating them as
   * one more seek target. */
  function cancelScrub(event: React.PointerEvent<HTMLDivElement>) {
    if (!isScrubbing) return;
    event.stopPropagation();
    if (scrubRafRef.current !== null) {
      window.cancelAnimationFrame(scrubRafRef.current);
      scrubRafRef.current = null;
      pendingScrubTimeRef.current = null;
    }
    setIsScrubbing(false);
    releaseScrubPointerCapture(event);
  }

  function releaseScrubPointerCapture(event: React.PointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released (e.g. this fired after a pointercancel already did).
    }
  }

  function handleScrubKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const el = videoRef.current;
    if (!el || duration <= 0) return;

    let nextTime: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextTime = Math.max(
        0,
        el.currentTime - (event.shiftKey ? SCRUB_KEY_BIG_STEP_SECONDS : SCRUB_KEY_STEP_SECONDS),
      );
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextTime = Math.min(
        duration,
        el.currentTime + (event.shiftKey ? SCRUB_KEY_BIG_STEP_SECONDS : SCRUB_KEY_STEP_SECONDS),
      );
    } else if (event.key === "Home") {
      nextTime = 0;
    } else if (event.key === "End") {
      nextTime = duration;
    }
    if (nextTime === null) return;

    event.preventDefault();
    event.stopPropagation();
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-video-control='true']")) return;
    tapStartRef.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-video-control='true']")) return;

    const start = tapStartRef.current;
    tapStartRef.current = null;
    if (!start) return;
    if (Math.abs(event.clientX - start.x) > 14 || Math.abs(event.clientY - start.y) > 14) return;

    const zone = getVideoTapZone(event.clientX, event.currentTarget.getBoundingClientRect());
    const previous = lastTapRef.current;
    if (previous && previous.zone === zone && event.timeStamp - previous.time <= DOUBLE_TAP_WINDOW_MS) {
      lastTapRef.current = null;
      if (tapTimerRef.current !== null) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      if (zone !== "center") seekVideo(zone);
      return;
    }

    lastTapRef.current = { time: event.timeStamp, zone };
    if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => {
      lastTapRef.current = null;
      tapTimerRef.current = null;
      togglePlayback();
    }, DOUBLE_TAP_WINDOW_MS);
  }

  const framedStyle =
    hasFramedCrop && frameSize.width > 0 && crop
      ? (() => {
          const scale = Math.max(frameSize.width / naturalWidth!, frameSize.height / naturalHeight!) * crop.zoom;
          const offsetX = crop.offsetXFrac * frameSize.width;
          const offsetY = crop.offsetYFrac * frameSize.height;
          return {
            width: naturalWidth,
            height: naturalHeight,
            maxWidth: "none",
            transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          } as const;
        })()
      : undefined;

  return (
    <div
      ref={frameRef}
      data-video-player="true"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        tapStartRef.current = null;
      }}
      className="relative h-full w-full touch-manipulation overflow-hidden bg-black"
    >
      <video
        ref={videoRef}
        src={isHls ? undefined : playbackSrc}
        poster={posterUrl}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noremoteplayback noplaybackrate"
        onContextMenu={(event) => event.preventDefault()}
        tabIndex={0}
        aria-label="Post video. Press Space to play or pause. Use Left and Right Arrow to seek ten seconds."
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            togglePlayback();
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            seekVideo("backward");
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            seekVideo("forward");
          }
        }}
        onLoadedData={() => {
          setPlaybackState((current) => (current === "playing" ? current : "ready"));
          void attemptPlayback();
        }}
        onCanPlay={() => {
          setPlaybackState((current) => (current === "playing" ? current : "ready"));
          void attemptPlayback();
        }}
        onPlaying={() => setPlaybackState("playing")}
        onWaiting={() => {
          if (inViewRef.current && !manuallyPausedRef.current) setPlaybackState("loading");
        }}
        onTimeUpdate={(event) => {
          // A drag already owns the displayed position (`scrubTime`) - a `timeupdate`
          // arriving mid-drag reflects the seek from a moment ago, not where the pointer
          // is now, and applying it would make the thumb visibly stutter backwards.
          if (!isScrubbing) setCurrentTime(event.currentTarget.currentTime);
          updateBufferedFraction();
        }}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) && value > 0 ? value : 0);
        }}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) && value > 0 ? value : 0);
        }}
        onProgress={updateBufferedFraction}
        onError={() => {
          // hls.js owns media errors while it is attached and performs the bounded
          // recovery above. Plain MP4 and native-HLS errors need the UI fallback, and
          // only the CDN can say whether this is a video still being encoded.
          if (!hlsManagedRef.current) void handleFailedLoad();
        }}
        className={
          hasFramedCrop
            ? "absolute left-1/2 top-1/2 cursor-pointer select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
            : "h-full w-full cursor-pointer object-cover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
        }
        style={framedStyle}
      />
      {playbackState === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <LoaderCircle className="h-5 w-5 motion-safe:animate-spin" />
          </span>
        </div>
      )}
      {playbackState === "processing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35 px-6 text-center backdrop-blur-[1px]">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            <LoaderCircle className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-white">Getting this video ready</p>
          <p className="max-w-xs text-xs leading-5 text-white/80">
            It will start playing here on its own in a moment.
          </p>
        </div>
      )}
      {playbackState === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 px-6 backdrop-blur-[1px]">
          <button
            type="button"
            data-video-control="true"
            data-post-carousel-control="true"
            onClick={(event) => {
              event.stopPropagation();
              manuallyPausedRef.current = false;
              setManuallyPaused(false);
              processingChecksRef.current = 0;
              setPlaybackState("loading");
              setReloadKey((current) => current + 1);
            }}
            className="flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-lg transition-transform active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try video again
          </button>
        </div>
      )}
      {showPauseIcon && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-200">
            {manuallyPaused ? (
              <Play className="h-6 w-6" aria-hidden="true" fill="currentColor" />
            ) : (
              <Pause className="h-6 w-6" aria-hidden="true" fill="currentColor" />
            )}
          </span>
        </div>
      )}
      {seekFeedback && (
        <div
          className={`pointer-events-none absolute inset-y-0 flex w-[38%] items-center justify-center ${
            seekFeedback === "backward" ? "left-0" : "right-0"
          }`}
          aria-hidden="true"
        >
          <span className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 motion-safe:duration-150">
            {seekFeedback === "backward" ? (
              <RotateCcw className="h-5 w-5" />
            ) : (
              <RotateCw className="h-5 w-5" />
            )}
            <span className="mt-0.5 text-[10px] font-semibold tabular-nums">10s</span>
          </span>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {seekFeedback === "backward"
          ? "Rewound ten seconds"
          : seekFeedback === "forward"
            ? "Moved forward ten seconds"
            : ""}
      </span>
      {hasDuration && playbackState !== "error" && (
        <div
          data-video-control="true"
          data-post-carousel-control="true"
          className="absolute inset-x-3 bottom-2"
        >
          {isScrubBarActive && (
            <div className="pointer-events-none mb-1.5 flex items-center justify-between">
              <span className="rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm">
                {formatPlaybackTime(displayTime)}
              </span>
              <span className="rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm">
                {formatPlaybackTime(duration)}
              </span>
            </div>
          )}
          <div
            ref={scrubTrackRef}
            role="slider"
            tabIndex={0}
            aria-label="Seek video"
            aria-valuemin={0}
            aria-valuemax={Math.max(1, Math.round(duration))}
            aria-valuenow={Math.round(displayTime)}
            aria-valuetext={`${formatPlaybackTime(displayTime)} of ${formatPlaybackTime(duration)}`}
            onPointerDown={handleScrubPointerDown}
            onPointerMove={handleScrubPointerMove}
            onPointerUp={endScrub}
            onPointerCancel={cancelScrub}
            onPointerEnter={() => setIsScrubBarHovering(true)}
            onPointerLeave={() => setIsScrubBarHovering(false)}
            onFocus={() => setIsScrubBarFocused(true)}
            onBlur={() => setIsScrubBarFocused(false)}
            onKeyDown={handleScrubKeyDown}
            className="relative h-4 w-full cursor-pointer touch-none focus-visible:outline-none"
          >
            <span
              className={cn(
                "pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-white/25 transition-[height] duration-150",
                isScrubBarActive ? "h-[5px]" : "h-[3px]",
              )}
            />
            <span
              className={cn(
                "pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white/45 transition-[height] duration-150",
                isScrubBarActive ? "h-[5px]" : "h-[3px]",
              )}
              style={{ width: `${bufferedFraction * 100}%` }}
            />
            <span
              className={cn(
                "pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white transition-[height] duration-150",
                isScrubBarActive ? "h-[5px]" : "h-[3px]",
              )}
              style={{ width: `${displayFraction * 100}%` }}
            />
            {isScrubBarActive && (
              <span
                className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md"
                style={{ left: `${displayFraction * 100}%` }}
              />
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        data-video-control="true"
        data-post-carousel-control="true"
        onClick={(event) => {
          event.stopPropagation();
          setMuted((current) => !current);
        }}
        aria-label={muted ? "Unmute video" : "Mute video"}
        aria-pressed={!muted}
        className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
      >
        {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
      </button>
      <details
        data-video-control="true"
        data-post-carousel-control="true"
        className="absolute bottom-3 right-3"
      >
        <summary
          aria-label="Playback speed"
          className="flex h-11 min-w-12 cursor-pointer list-none items-center justify-center rounded-full bg-black/50 px-3 text-center text-xs font-semibold tabular-nums text-white backdrop-blur transition-colors hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden"
        >
          {playbackRate}x
        </summary>
        <div
          role="radiogroup"
          aria-label="Playback speed"
          className="absolute bottom-14 right-0 z-10 flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/80 p-1.5 shadow-lift backdrop-blur-md"
        >
          {PLAYBACK_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              role="radio"
              aria-checked={playbackRate === rate}
              onClick={(event) => {
                setPlaybackRate(rate);
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
              className={cn(
                "min-h-9 min-w-12 rounded-full px-3 text-xs font-semibold tabular-nums transition-colors",
                playbackRate === rate
                  ? "bg-white text-black"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              {rate}x
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
