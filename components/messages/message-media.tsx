"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";

import { VoiceNotePlayer } from "@/components/messages/voice-note-player";
import type { ConversationMessage } from "@/lib/message-types";

export function MessageMedia({ message, isMine }: { message: ConversationMessage; isMine: boolean }) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  if (!message.mediaUrl || !message.mediaType) return null;

  if (message.mediaType === "audio") {
    return <VoiceNotePlayer src={message.mediaUrl} isMine={isMine} durationHint={message.mediaDurationSeconds ?? 0} />;
  }

  const width = message.mediaWidth ?? 1080;
  const height = message.mediaHeight ?? 1080;
  return (
    <>
      {message.mediaType === "image" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open shared photo"
          className="block w-full overflow-hidden rounded-[11px] text-left"
        >
          <Image
            src={message.mediaUrl}
            alt="Shared photo"
            width={width}
            height={height}
            sizes="(max-width: 768px) 78vw, 420px"
            className="max-h-[420px] w-full rounded-[11px] object-cover"
          />
        </button>
      ) : (
        <video
          src={message.mediaUrl}
          controls
          playsInline
          preload="metadata"
          onPointerDown={(event) => event.stopPropagation()}
          className="max-h-[420px] w-full rounded-[11px] bg-black object-contain"
        />
      )}
      {open && typeof document !== "undefined" && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Media preview" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 p-3 md:p-8" onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)}>
          <button ref={closeButtonRef} type="button" aria-label="Close media preview" onClick={() => setOpen(false)} className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white hover:bg-white/20">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex max-h-full max-w-5xl items-center justify-center" onClick={(event) => event.stopPropagation()}>
            {message.mediaType === "image" ? (
              <Image src={message.mediaUrl} alt="Shared photo" width={width} height={height} sizes="100vw" className="max-h-[92dvh] w-auto max-w-full object-contain" />
            ) : null}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
