"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export function PostVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        // Autoplay-on-scroll is the whole point of a feed video, but reduced-motion users get a tap-to-play video instead of it starting on its own.
        if (inView && !reducedMotion && !manuallyPaused) {
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, manuallyPaused]);

  function toggleReducedMotionPlayback() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {});
      setManuallyPaused(false);
    } else {
      el.pause();
      setManuallyPaused(true);
    }
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
        onClick={reducedMotion ? toggleReducedMotionPlayback : undefined}
        className="h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={() => setMuted((current) => !current)}
        aria-label={muted ? "Unmute video" : "Mute video"}
        aria-pressed={!muted}
        className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
      >
        {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
