"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

import type { VideoCrop } from "@/lib/post-shared";
import { getVideoPosterUrl, isHlsVideoSource } from "@/lib/video-playback";

type PlaybackState = "loading" | "ready" | "playing" | "paused" | "error";

export function PostVideoPlayer({
  src,
  naturalWidth,
  naturalHeight,
  crop,
}: {
  src: string;
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
  const [muted, setMuted] = useState(true);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const hasFramedCrop = Boolean(crop && naturalWidth && naturalHeight);
  const isHls = isHlsVideoSource(src);
  const posterUrl = getVideoPosterUrl(src);

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
      video.src = src;
      video.load();
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
          if (!cancelled) hls?.loadSource(src);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          setPlaybackState("ready");
          void attemptPlayback();
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (cancelled || !data.fatal || !hls) return;

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

          setPlaybackState("error");
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
  }, [attemptPlayback, isHls, reloadKey, src]);

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
    window.setTimeout(() => setShowPauseIcon(false), 500);
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
    <div ref={frameRef} className="relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={isHls ? undefined : src}
        poster={posterUrl}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noremoteplayback noplaybackrate"
        onContextMenu={(event) => event.preventDefault()}
        onClick={togglePlayback}
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
        onError={() => {
          // hls.js owns media errors while it is attached and performs the bounded
          // recovery above. Plain MP4 and native-HLS errors need the UI fallback.
          if (!hlsManagedRef.current) setPlaybackState("error");
        }}
        className={
          hasFramedCrop
            ? "absolute left-1/2 top-1/2 cursor-pointer select-none"
            : "h-full w-full cursor-pointer object-cover"
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
      {playbackState === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 px-6 backdrop-blur-[1px]">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              manuallyPausedRef.current = false;
              setManuallyPaused(false);
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
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setMuted((current) => !current);
        }}
        aria-label={muted ? "Unmute video" : "Mute video"}
        aria-pressed={!muted}
        className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
      >
        {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
