"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";

import { isHlsVideoSource } from "@/lib/video-playback";

type PlaybackState = "loading" | "ready" | "error";

/** Admin review needs the same HLS compatibility as the public feed. A bare
 * `<video src="...m3u8">` only works in browsers with native HLS (not Chrome/Firefox),
 * which made healthy Bunny videos look broken in the moderation console. */
export function AdminVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsManagedRef = useRef(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const isHls = isHlsVideoSource(src);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const videoElement = video;

    let hls: import("hls.js").default | null = null;
    let cancelled = false;
    let networkRecoveries = 0;
    let mediaRecoveries = 0;
    hlsManagedRef.current = false;
    setPlaybackState("loading");

    function attachNativeSource() {
      if (cancelled) return;
      videoElement.src = src;
      videoElement.load();
    }

    if (!isHls) {
      attachNativeSource();
      return () => {
        cancelled = true;
        videoElement.pause();
        videoElement.removeAttribute("src");
        videoElement.load();
      };
    }

    void import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          attachNativeSource();
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
          if (!cancelled) setPlaybackState("ready");
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
        hls.attachMedia(videoElement);
      })
      .catch(() => attachNativeSource());

    return () => {
      cancelled = true;
      hls?.destroy();
      hlsManagedRef.current = false;
      videoElement.pause();
      videoElement.removeAttribute("src");
      videoElement.load();
    };
  }, [isHls, reloadKey, src]);

  return (
    <div className="relative flex max-h-[90vh] max-w-[94vw] items-center justify-center overflow-hidden rounded-lg bg-black">
      {/* Admin-only review tool; captions can only be shown when the uploaded source has them. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={isHls ? undefined : src}
        controls
        autoPlay
        playsInline
        preload="metadata"
        aria-label="Video under administrative review"
        onCanPlay={() => setPlaybackState("ready")}
        onLoadedData={() => setPlaybackState("ready")}
        onError={() => {
          if (!hlsManagedRef.current) setPlaybackState("error");
        }}
        className="max-h-[90vh] max-w-[94vw] object-contain"
      />

      {playbackState === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
          <LoaderCircle className="h-6 w-6 animate-spin text-white" aria-hidden="true" />
          <span className="sr-only">Loading video</span>
        </div>
      )}

      {playbackState === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-6">
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try video again
          </button>
        </div>
      )}
    </div>
  );
}
