"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreviewTracks, useMediaDevices } from "@livekit/components-react";
import type { LocalVideoTrack } from "livekit-client";
import { Mic, MicOff, Video as VideoIcon, VideoOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CONTROL_PILL = "flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors";

export function GoLiveStaging({ defaultTitle }: { defaultTitle: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoDeviceId, setVideoDeviceId] = useState<string | undefined>();
  const [audioDeviceId, setAudioDeviceId] = useState<string | undefined>();
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoDevices = useMediaDevices({ kind: "videoinput" });
  const audioDevices = useMediaDevices({ kind: "audioinput" });

  const tracks = usePreviewTracks(
    {
      audio: audioEnabled ? (audioDeviceId ? { deviceId: audioDeviceId } : true) : false,
      video: videoEnabled ? (videoDeviceId ? { deviceId: videoDeviceId } : true) : false,
    },
    (err) => setError(err.message)
  );

  useEffect(() => {
    const videoTrack = tracks?.find((t) => t.kind === "video") as LocalVideoTrack | undefined;
    const el = videoRef.current;
    if (videoTrack && el) {
      videoTrack.attach(el);
      return () => {
        videoTrack.detach(el);
      };
    }
  }, [tracks]);

  async function handleGoLive() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't start your stream.");
      return;
    }

    const cam = videoEnabled ? "1" : "0";
    const mic = audioEnabled ? "1" : "0";
    router.push(`/live/${body.stream.id}?cam=${cam}&mic=${mic}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stream-title" className="text-sm font-medium text-foreground">
          Stream title
        </label>
        <input
          id="stream-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={defaultTitle}
          className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-black shadow-card">
        <div className="relative aspect-[9/16] w-full max-h-[70vh] sm:aspect-video sm:max-h-none">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-black text-sm text-white/60">
              Camera is off
            </div>
          )}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3">
            <button
              type="button"
              onClick={() => setAudioEnabled((v) => !v)}
              aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
              className={cn(CONTROL_PILL, audioEnabled ? "bg-white/15 hover:bg-white/25" : "bg-destructive")}
            >
              {audioEnabled ? <Mic className="h-5 w-5" aria-hidden="true" /> : <MicOff className="h-5 w-5" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setVideoEnabled((v) => !v)}
              aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
              className={cn(CONTROL_PILL, videoEnabled ? "bg-white/15 hover:bg-white/25" : "bg-destructive")}
            >
              {videoEnabled ? (
                <VideoIcon className="h-5 w-5" aria-hidden="true" />
              ) : (
                <VideoOff className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-white/70">
            Microphone
            <select
              value={audioDeviceId ?? ""}
              onChange={(e) => setAudioDeviceId(e.target.value || undefined)}
              className="h-10 rounded-lg border border-white/15 bg-white/10 px-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">System default</option>
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || "Microphone"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-white/70">
            Camera
            <select
              value={videoDeviceId ?? ""}
              onChange={(e) => setVideoDeviceId(e.target.value || undefined)}
              className="h-10 rounded-lg border border-white/15 bg-white/10 px-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">System default</option>
              {videoDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || "Camera"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <Button type="button" size="lg" disabled={pending} onClick={handleGoLive}>
        {pending ? "Starting…" : "Go live"}
      </Button>
    </div>
  );
}
