"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Circle, RotateCcw, X } from "lucide-react";

import { useFocusTrap } from "@/lib/use-focus-trap";

const RECORD_SECONDS = 5;
// Deliberately modest - a face-and-voice clip for manual review doesn't need
// high resolution or bitrate. This is what actually keeps the file small (well
// under 1MB for 5 seconds) instead of the 20-50MB a phone's native camera app
// produces at its default settings, which is what made uploads slow before.
const VIDEO_BITRATE = 700_000;
const AUDIO_BITRATE = 64_000;
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "user",
  width: { ideal: 480 },
  height: { ideal: 640 },
};

export function isSelfieRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function pickMimeType(): string | undefined {
  return ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type)
  );
}

type Phase = "starting" | "live" | "recording" | "preview" | "error";

export function SelfieRecorder({
  open,
  onClose,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  onRecorded: (file: File) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<Phase>("starting");
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusTrap(open, dialogRef);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    // The live-preview <video> and the recorded-clip <video> sit in the same JSX position,
    // so React patches one DOM node rather than remounting - srcObject is an imperative
    // property, not a prop, so it survives that patch and silently overrides the `src`
    // attribute (srcObject wins per spec) unless explicitly cleared here, leaving the
    // preview stuck showing the now-dead camera stream instead of the recorded clip.
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function startCamera() {
    setPhase("starting");
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => null);
      }
      setPhase("live");
    } catch (err) {
      setPhase("error");
      setErrorMessage(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access is needed to record your selfie."
          : "Couldn't start the camera. Try again."
      );
    }
  }

  useEffect(() => {
    if (!open) return;
    startCamera();

    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = pickMimeType();
    const options = { videoBitsPerSecond: VIDEO_BITRATE, audioBitsPerSecond: AUDIO_BITRATE };
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType, ...options }) : new MediaRecorder(stream, options);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const baseType = (recorder.mimeType || chunksRef.current[0]?.type || "video/webm").split(";")[0];
      const blob = new Blob(chunksRef.current, { type: baseType });
      chunksRef.current = [];
      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setPhase("preview");
      stopStream();
    };

    recorder.start();
    setPhase("recording");
    setSecondsLeft(RECORD_SECONDS);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      setSecondsLeft(Math.max(0, RECORD_SECONDS - Math.floor(elapsedMs / 1000)));
      if (elapsedMs >= RECORD_SECONDS * 1000) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (recorder.state !== "inactive") recorder.stop();
      }
    }, 200);
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedBlob(null);
    startCamera();
  }

  function useClip() {
    if (!recordedBlob) return;
    const extension = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
    onRecorded(new File([recordedBlob], `selfie.${extension}`, { type: recordedBlob.type }));
    handleClose();
  }

  function handleClose() {
    stopStream();
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedBlob(null);
    setPhase("starting");
    onClose();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Record selfie video"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
    >
      <div ref={dialogRef} tabIndex={-1} className="flex w-full max-w-xs flex-col gap-3 rounded-2xl bg-card p-4 shadow-2xl focus:outline-none">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
          {phase === "preview" && previewUrl ? (
            <video src={previewUrl} className="h-full w-full object-cover" controls autoPlay loop playsInline />
          ) : (
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          )}
          {phase === "recording" && (
            <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
              <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" aria-hidden="true" />
              {secondsLeft}s
            </div>
          )}
          {phase === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">Starting camera...</div>
          )}
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          Say &ldquo;Udala&rdquo; and your name, clearly, in your own voice.
        </p>

        {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-input px-3 text-sm font-medium hover:bg-accent"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Cancel
          </button>

          {phase === "live" && (
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Circle className="h-4 w-4 fill-current" aria-hidden="true" /> Record 5s
            </button>
          )}

          {phase === "error" && (
            <button
              type="button"
              onClick={startCamera}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Try again
            </button>
          )}

          {phase === "preview" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={retake}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-input px-3 text-sm font-medium hover:bg-accent"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Retake
              </button>
              <button
                type="button"
                onClick={useClip}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Check className="h-4 w-4" aria-hidden="true" /> Use this
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
