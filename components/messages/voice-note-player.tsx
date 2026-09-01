"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

function formatDuration(value: number) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function VoiceNotePlayer({ src, isMine, durationHint = 0 }: { src: string; isMine: boolean; durationHint?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : durationHint);
    const stop = () => setPlaying(false);
    const play = () => setPlaying(true);
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", stop);
    audio.addEventListener("pause", stop);
    audio.addEventListener("play", play);
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", stop);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("play", play);
    };
  }, [durationHint]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  }

  return (
    <div className="flex min-w-[220px] max-w-[280px] items-center gap-2.5 px-1 py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={togglePlayback}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
          isMine
            ? "bg-[hsl(var(--chat-outgoing-foreground)/0.16)] text-[hsl(var(--chat-outgoing-foreground))]"
            : "bg-[hsl(var(--chat-outgoing)/0.12)] text-[hsl(var(--chat-outgoing))]"
        )}
      >
        {playing ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(currentTime, duration || 1)}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            const next = Number(event.target.value);
            setCurrentTime(next);
            if (audioRef.current) audioRef.current.currentTime = next;
          }}
          aria-label="Voice note position"
          className={cn("h-1.5 w-full cursor-pointer accent-current", isMine ? "text-white" : "text-[hsl(var(--chat-outgoing))]")}
        />
        <div className={cn("mt-1 flex items-center justify-between text-[10px]", isMine ? "text-white/70" : "text-muted-foreground")}>
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>
    </div>
  );
}
