"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";

import { useFocusTrap } from "@/lib/use-focus-trap";

export function ImageViewerDialog({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, dialogRef);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} full view`}
      className="fixed inset-0 z-[70] grid place-items-center bg-black/95 px-3 py-[max(0.75rem,env(safe-area-inset-top))]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div ref={dialogRef} tabIndex={-1} className="relative h-full w-full max-w-5xl focus:outline-none">
        <Image src={src} alt={alt} fill sizes="100vw" className="object-contain" priority />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close full view"
          className="absolute right-1 top-1 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
