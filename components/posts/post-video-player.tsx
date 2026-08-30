"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

export function PostVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);

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

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noremoteplayback noplaybackrate"
        onContextMenu={(event) => event.preventDefault()}
        onClick={togglePlayback}
        className="h-full w-full cursor-pointer object-cover"
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
