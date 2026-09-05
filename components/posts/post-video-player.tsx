"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

import type { VideoCrop } from "@/lib/post-shared";

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
  const [muted, setMuted] = useState(true);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const hasFramedCrop = Boolean(crop && naturalWidth && naturalHeight);
  const isHls = src.endsWith(".m3u8");

  // Bunny Stream serves adaptive-bitrate HLS (.m3u8); Cloudinary/R2 posts still use a plain
  // mp4 url and skip all of this. Safari has native HLS support in <video> - every other
  // browser needs hls.js to demux the manifest, so it's loaded lazily and only for HLS
  // sources rather than bundled for every post.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isHls) return;

    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
      return;
    }

    let hls: import("hls.js").default | null = null;
    let cancelled = false;

    import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(el);
    });

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src, isHls]);

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
    if (el) el.muted = muted;
  }, [muted]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        // Autoplay-on-scroll for everyone, on every device - a viewer who wants it stopped can tap to pause themselves.
        if (inView && !manuallyPaused) {
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [manuallyPaused]);

  function togglePlayback() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {});
      setManuallyPaused(false);
    } else {
      el.pause();
      setManuallyPaused(true);
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
    <div ref={frameRef} className="relative h-full w-full overflow-hidden">
      <video
        ref={videoRef}
        src={isHls ? undefined : src}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noremoteplayback noplaybackrate"
        onContextMenu={(event) => event.preventDefault()}
        onClick={togglePlayback}
        className={
          hasFramedCrop
            ? "absolute left-1/2 top-1/2 cursor-pointer select-none"
            : "h-full w-full cursor-pointer object-cover"
        }
        style={framedStyle}
      />
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
