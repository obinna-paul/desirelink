"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMediaDevices, usePreviewTracks } from "@livekit/components-react";
import type { LocalAudioTrack, LocalTrack, LocalVideoTrack } from "livekit-client";
import {
  ArrowLeft,
  Bell,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Heart,
  Mic,
  MicOff,
  Plus,
  Radio,
  RotateCcw,
  Settings2,
  Trash2,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";

import { cn } from "@/lib/utils";

type RequestOption = { label: string; hearts: number | "" };
type PreviewState = "connecting" | "ready" | "camera-off" | "error";

const MAX_REQUESTS = 8;
const CONTROL_BUTTON =
  "flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.15] bg-black/[0.45] text-white backdrop-blur-md transition-colors hover:bg-black/[0.65] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80";

function cameraErrorMessage(error: Error): string {
  const name = error.name.toLowerCase();
  if (name.includes("notallowed") || name.includes("permission")) {
    return "Camera access is blocked. Allow camera and microphone access in your browser, then try again.";
  }
  if (name.includes("notfound") || name.includes("devicenotfound")) {
    return "No camera was found on this device.";
  }
  if (name.includes("notreadable") || name.includes("trackstart")) {
    return "Your camera is already being used by another app.";
  }
  return "We couldn't start your camera. Check your device settings and try again.";
}

function MicrophoneMeter({ track, enabled }: { track?: LocalAudioTrack; enabled: boolean }) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!track || !enabled) {
      setLevel(0);
      return;
    }

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 128;
    const source = context.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;

    const read = () => {
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / Math.max(1, data.length);
      setLevel(Math.min(1, average / 90));
      frame = requestAnimationFrame(read);
    };
    void context.resume().catch(() => undefined);
    read();

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void context.close();
    };
  }, [enabled, track]);

  return (
    <div className="flex h-4 items-end gap-1" aria-label={enabled ? "Microphone level" : "Microphone muted"}>
      {[0.18, 0.36, 0.58, 0.8, 1].map((threshold) => (
        <span
          key={threshold}
          className={cn("w-1 rounded-full transition-colors", level >= threshold ? "bg-emerald-400" : "bg-white/20")}
          style={{ height: `${8 + threshold * 8}px` }}
        />
      ))}
    </div>
  );
}

export function GoLiveStaging({
  defaultTitle,
  defaultRequestOptions,
}: {
  defaultTitle: string;
  defaultRequestOptions: Array<{ label: string; hearts: number }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [heartGoal, setHeartGoal] = useState<number | "">("");
  const [requestOptions, setRequestOptions] = useState<RequestOption[]>(defaultRequestOptions);
  const [notifySubscribers, setNotifySubscribers] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>("connecting");
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoDeviceId, setVideoDeviceId] = useState<string>();
  const [audioDeviceId, setAudioDeviceId] = useState<string>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const tracksRef = useRef<LocalTrack[]>([]);

  const onPreviewError = useCallback((previewError: Error) => {
    setPreviewState("error");
    setError(cameraErrorMessage(previewError));
  }, []);

  const constraints = useMemo(
    () => ({
      audio: audioEnabled ? (audioDeviceId ? { deviceId: audioDeviceId } : true) : false,
      video: videoEnabled
        ? videoDeviceId
          ? { deviceId: videoDeviceId, facingMode: "user" as const }
          : { facingMode: "user" as const }
        : false,
    }),
    [audioDeviceId, audioEnabled, videoDeviceId, videoEnabled],
  );

  const tracks = usePreviewTracks(constraints, onPreviewError);
  const videoDevices = useMediaDevices({ kind: "videoinput", onError: onPreviewError });
  const audioDevices = useMediaDevices({ kind: "audioinput", onError: onPreviewError });
  const videoTrack = tracks?.find((track) => track.kind === "video") as LocalVideoTrack | undefined;
  const audioTrack = tracks?.find((track) => track.kind === "audio") as LocalAudioTrack | undefined;

  useEffect(() => {
    const element = videoRef.current;
    if (!videoTrack || !element) return;
    videoTrack.attach(element);
    return () => {
      videoTrack.detach(element);
    };
  }, [videoTrack]);

  useEffect(() => {
    if (!videoEnabled) setPreviewState("camera-off");
    else if (!videoTrack && previewState !== "error") setPreviewState("connecting");
  }, [previewState, videoEnabled, videoTrack]);

  useEffect(() => {
    tracksRef.current = tracks ?? [];
  }, [tracks]);

  useEffect(() => () => tracksRef.current.forEach((track) => track.stop()), []);

  function updateRequest(index: number, patch: Partial<RequestOption>) {
    setRequestOptions((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)),
    );
  }

  function addRequest() {
    if (requestOptions.length < MAX_REQUESTS) {
      setRequestOptions((current) => [...current, { label: "", hearts: "" }]);
    }
  }

  function removeRequest(index: number) {
    setRequestOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
  }

  function retryPreview() {
    setError(null);
    setPreviewState("connecting");
    tracks?.forEach((track) => track.stop());
    setVideoEnabled(false);
    window.setTimeout(() => setVideoEnabled(true), 120);
  }

  async function handleGoLive() {
    // Requests are optional - a row left completely blank is just an unused slot and is
    // dropped silently. A row with only one side filled in is a genuine mistake, so that
    // still blocks going live rather than being submitted half-formed.
    const rows = requestOptions.map((option) => ({
      label: option.label.trim(),
      hearts: typeof option.hearts === "number" ? option.hearts : Number.NaN,
    }));
    const normalizedRequests = rows.filter((option) => option.label || Number.isInteger(option.hearts));
    if (normalizedRequests.some((option) => !option.label || !Number.isInteger(option.hearts) || option.hearts < 1)) {
      setError("Finish or remove any request that's only partly filled in.");
      return;
    }

    setPending(true);
    setError(null);
    const response = await fetch("/api/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        heartGoal: heartGoal === "" ? null : heartGoal,
        requestOptions: normalizedRequests,
        notifySubscribers,
      }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setPending(false);
      setError(body?.error ?? "Couldn't start your stream.");
      return;
    }

    tracks?.forEach((track) => track.stop());
    router.push(`/live/${body.stream.id}?cam=${videoEnabled ? "1" : "0"}&mic=${audioEnabled ? "1" : "0"}`);
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#070707] text-white lg:overflow-hidden">
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_420px]">
        <main className="relative flex min-h-[52dvh] flex-col bg-black lg:h-dvh lg:min-h-0">
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-3 pb-10 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:px-6 lg:pt-5">
            <button
              type="button"
              onClick={() => router.back()}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-xs font-medium text-white/[0.85] backdrop-blur-md">
              {previewState === "ready" ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> : <Camera className="h-3.5 w-3.5" aria-hidden="true" />}
              {previewState === "ready" ? "Ready" : previewState === "camera-off" ? "Camera off" : previewState === "error" ? "Needs attention" : "Starting camera"}
            </div>
          </header>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onCanPlay={() => {
                setPreviewState("ready");
                setError(null);
              }}
              className={cn("h-full w-full object-cover transition-opacity duration-300", previewState === "ready" ? "opacity-100" : "opacity-45")}
            />
            {previewState === "connecting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" />
                <p className="text-sm text-white/70">Preparing your camera</p>
              </div>
            )}
            {previewState === "camera-off" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#101010]">
                <VideoOff className="h-8 w-8 text-white/[0.45]" aria-hidden="true" />
                <p className="text-sm text-white/60">Camera is off</p>
              </div>
            )}
            {previewState === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#101010] px-8 text-center">
                <VideoOff className="h-9 w-9 text-red-300" aria-hidden="true" />
                <p className="max-w-sm text-sm leading-6 text-white/70">{error}</p>
                <button type="button" onClick={retryPreview} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-white">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-3 pb-4 pt-16 lg:px-6 lg:pb-6">
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setAudioEnabled((current) => !current)} aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"} className={cn(CONTROL_BUTTON, !audioEnabled && "border-red-400/40 bg-red-500/80")}>
                    {audioEnabled ? <Mic className="h-5 w-5" aria-hidden="true" /> : <MicOff className="h-5 w-5" aria-hidden="true" />}
                  </button>
                  <button type="button" onClick={() => setVideoEnabled((current) => !current)} aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"} className={cn(CONTROL_BUTTON, !videoEnabled && "border-red-400/40 bg-red-500/80")}>
                    {videoEnabled ? <VideoIcon className="h-5 w-5" aria-hidden="true" /> : <VideoOff className="h-5 w-5" aria-hidden="true" />}
                  </button>
                  <MicrophoneMeter track={audioTrack} enabled={audioEnabled} />
                </div>
                <div className="hidden w-full max-w-md lg:block">
                  <DeviceSelects {...{ audioDevices, videoDevices, audioDeviceId, videoDeviceId, setAudioDeviceId, setVideoDeviceId }} />
                </div>
              </div>
            </div>
          </div>
        </main>

        <SetupPanel
          {...{
            title,
            setTitle,
            defaultTitle,
            requestOptions,
            updateRequest,
            addRequest,
            removeRequest,
            heartGoal,
            setHeartGoal,
            notifySubscribers,
            setNotifySubscribers,
            audioDevices,
            videoDevices,
            audioDeviceId,
            videoDeviceId,
            setAudioDeviceId,
            setVideoDeviceId,
            error,
            pending,
            previewState,
            handleGoLive,
          }}
        />
      </div>
    </div>
  );
}

function SetupPanel({
  title,
  setTitle,
  defaultTitle,
  requestOptions,
  updateRequest,
  addRequest,
  removeRequest,
  heartGoal,
  setHeartGoal,
  notifySubscribers,
  setNotifySubscribers,
  audioDevices,
  videoDevices,
  audioDeviceId,
  videoDeviceId,
  setAudioDeviceId,
  setVideoDeviceId,
  error,
  pending,
  previewState,
  handleGoLive,
}: {
  title: string;
  setTitle: (value: string) => void;
  defaultTitle: string;
  requestOptions: RequestOption[];
  updateRequest: (index: number, patch: Partial<RequestOption>) => void;
  addRequest: () => void;
  removeRequest: (index: number) => void;
  heartGoal: number | "";
  setHeartGoal: (value: number | "") => void;
  notifySubscribers: boolean;
  setNotifySubscribers: (value: boolean) => void;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  audioDeviceId?: string;
  videoDeviceId?: string;
  setAudioDeviceId: (value?: string) => void;
  setVideoDeviceId: (value?: string) => void;
  error: string | null;
  pending: boolean;
  previewState: PreviewState;
  handleGoLive: () => void;
}) {
  const footerRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setShowScrollHint(!entry.isIntersecting), { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <aside className="relative flex flex-col bg-[#111111] lg:h-dvh lg:border-l lg:border-white/10">
      <div className="hidden items-center justify-between border-b border-white/10 px-6 py-5 lg:flex">
        <div>
          <p className="text-base font-semibold text-white">Set up your live</p>
          <p className="mt-0.5 text-sm text-white/[0.55]">Everything can be adjusted before you begin.</p>
        </div>
        <Settings2 className="h-5 w-5 text-white/[0.45]" aria-hidden="true" />
      </div>

      <div className="flex-1 space-y-8 px-4 py-6 lg:overflow-y-auto lg:px-6">
        <section className="space-y-3">
          <label htmlFor="stream-title" className="text-sm font-medium text-white">Title</label>
          <input id="stream-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder={defaultTitle} className="h-12 w-full border-0 border-b border-white/20 bg-transparent px-0 text-base text-white outline-none transition-colors placeholder:text-white/35 focus:border-fuchsia-400" />
        </section>

        <section className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Viewer requests <span className="font-normal text-white/40">Optional</span></p>
              <p className="mt-1 text-xs leading-5 text-white/50">Offer clear choices if you want them. Hearts stay protected until you complete one.</p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-white/40">{requestOptions.length}/{MAX_REQUESTS}</span>
          </div>
          {requestOptions.length > 0 && (
            <div className="divide-y divide-white/10 border-y border-white/10">
              {requestOptions.map((option, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_88px_44px] items-center gap-3 py-3">
                  <label className="min-w-0">
                    <span className="sr-only">Request {index + 1}</span>
                    <input value={option.label} onChange={(event) => updateRequest(index, { label: event.target.value })} maxLength={60} placeholder={index === 0 ? "A short request" : "Another option"} className="h-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
                  </label>
                  <label className="relative">
                    <Heart className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-fuchsia-400" aria-hidden="true" />
                    <span className="sr-only">Heart price</span>
                    <input type="number" min={1} max={10000} value={option.hearts} onChange={(event) => updateRequest(index, { hearts: event.target.value ? Number(event.target.value) : "" })} placeholder="Price" className="h-10 w-full bg-transparent pl-6 text-sm tabular-nums text-white outline-none placeholder:text-white/30" />
                  </label>
                  <button type="button" onClick={() => removeRequest(index)} className="flex h-11 w-11 items-center justify-center text-white/40 transition-colors hover:text-white" aria-label={`Remove request ${index + 1}`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {requestOptions.length < MAX_REQUESTS && (
            <button type="button" onClick={addRequest} className="flex min-h-11 items-center gap-2 text-sm font-medium text-fuchsia-300 transition-colors hover:text-fuchsia-200">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add request
            </button>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-white/[0.45]" aria-hidden="true" />
            <label htmlFor="heart-goal" className="text-sm font-medium text-white">Heart goal <span className="font-normal text-white/40">Optional</span></label>
          </div>
          <input id="heart-goal" type="number" min={1} max={1000000} value={heartGoal} onChange={(event) => setHeartGoal(event.target.value ? Number(event.target.value) : "")} placeholder="Set a goal for this live" className="h-12 w-full border-0 border-b border-white/20 bg-transparent px-0 text-sm text-white outline-none placeholder:text-white/30 focus:border-fuchsia-400" />
        </section>

        <section>
          <label htmlFor="notify-subscribers" className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
            <span className="flex items-start gap-2.5">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-white/[0.45]" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium text-white">Notify your subscribers</span>
                <span className="mt-0.5 block text-xs leading-5 text-white/50">Let people who subscribe to you know you just went live.</span>
              </span>
            </span>
            <button
              type="button"
              id="notify-subscribers"
              role="switch"
              aria-checked={notifySubscribers}
              onClick={() => setNotifySubscribers(!notifySubscribers)}
              className={cn(
                "flex h-7 w-12 shrink-0 items-center rounded-full border border-white/[0.15] p-0.5 transition-colors",
                notifySubscribers ? "bg-fuchsia-600" : "bg-white/10",
              )}
            >
              <span className={cn("h-5 w-5 rounded-full bg-white shadow transition-transform", notifySubscribers ? "translate-x-5" : "translate-x-0")} />
            </button>
          </label>
        </section>

        <section className="space-y-3 lg:hidden">
          <p className="text-sm font-medium text-white">Devices</p>
          <DeviceSelects {...{ audioDevices, videoDevices, audioDeviceId, videoDeviceId, setAudioDeviceId, setVideoDeviceId }} />
        </section>

        {error && <div role="alert" className="border-l-2 border-red-400 bg-red-400/10 px-3 py-2 text-sm leading-5 text-red-100">{error}</div>}

        <div ref={footerRef} className="border-t border-white/10 pt-6 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <button type="button" disabled={pending || previewState === "error"} onClick={handleGoLive} className="flex min-h-12 w-full items-center justify-between rounded-lg bg-fuchsia-600 px-5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(192,38,211,0.22)] transition-colors hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none">
            <span className="flex items-center gap-2"><Radio className="h-4 w-4" aria-hidden="true" />{pending ? "Starting live..." : "Go live"}</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {showScrollHint && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.9rem)] z-30 flex justify-center transition-opacity duration-300 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white/70 backdrop-blur-md motion-safe:animate-bounce">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      )}
    </aside>
  );
}

function DeviceSelects({
  audioDevices,
  videoDevices,
  audioDeviceId,
  videoDeviceId,
  setAudioDeviceId,
  setVideoDeviceId,
}: {
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  audioDeviceId?: string;
  videoDeviceId?: string;
  setAudioDeviceId: (value?: string) => void;
  setVideoDeviceId: (value?: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className="relative">
        <Mic className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/[0.55]" aria-hidden="true" />
        <span className="sr-only">Microphone</span>
        <select value={audioDeviceId ?? ""} onChange={(event) => setAudioDeviceId(event.target.value || undefined)} className="h-11 w-full appearance-none rounded-lg border border-white/[0.15] bg-white/10 pl-9 pr-7 text-xs text-white outline-none focus:border-white/40">
          <option value="">Default microphone</option>
          {audioDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
        </select>
      </label>
      <label className="relative">
        <VideoIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/[0.55]" aria-hidden="true" />
        <span className="sr-only">Camera</span>
        <select value={videoDeviceId ?? ""} onChange={(event) => setVideoDeviceId(event.target.value || undefined)} className="h-11 w-full appearance-none rounded-lg border border-white/[0.15] bg-white/10 pl-9 pr-7 text-xs text-white outline-none focus:border-white/40">
          <option value="">Default camera</option>
          {videoDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
        </select>
      </label>
    </div>
  );
}
