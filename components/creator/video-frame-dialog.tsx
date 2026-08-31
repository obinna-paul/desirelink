"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

import type { VideoCrop } from "@/lib/post-shared";
import { useFocusTrap } from "@/lib/use-focus-trap";

type Offset = { x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; startOffset: Offset } | null;

/**
 * Video can't be pixel-cropped in the browser the way a photo is, so instead of
 * redrawing pixels this records where the creator panned/zoomed within the post's
 * chosen frame (as fractions of frame size) - the feed player reproduces the exact
 * same window at any width, so what's previewed here is exactly what ships.
 */
export function VideoFrameDialog({
  file,
  ratio,
  onCancel,
  onConfirm,
  title = "Adjust video",
}: {
  file: File;
  ratio: number;
  onCancel: () => void;
  onConfirm: (result: { crop: VideoCrop; width: number; height: number; durationSeconds: number }) => void;
  title?: string;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [frameWidth, setFrameWidth] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<DragState>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(true, dialogRef);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setFrameWidth(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleLoadedMetadata() {
    const el = videoRef.current;
    if (!el) return;
    setNaturalSize({ width: el.videoWidth, height: el.videoHeight });
    setDuration(el.duration);
    void el.play().catch(() => {});
  }

  const frameHeight = frameWidth / ratio;

  function baseScaleFor(zoomLevel: number) {
    if (!naturalSize || !frameWidth) return zoomLevel;
    return Math.max(frameWidth / naturalSize.width, frameHeight / naturalSize.height) * zoomLevel;
  }

  function clampOffset(zoomLevel: number, next: Offset): Offset {
    if (!naturalSize || !frameWidth) return next;
    const scale = baseScaleFor(zoomLevel);
    const dispW = naturalSize.width * scale;
    const dispH = naturalSize.height * scale;
    const maxX = Math.max(0, (dispW - frameWidth) / 2);
    const maxY = Math.max(0, (dispH - frameHeight) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startOffset: offset };
  }
  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setOffset(clampOffset(zoom, { x: drag.startOffset.x + dx, y: drag.startOffset.y + dy }));
  }
  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom);
    setOffset((current) => clampOffset(nextZoom, current));
  }

  function handleConfirm() {
    if (!naturalSize) return;
    onConfirm({
      crop: {
        zoom,
        offsetXFrac: frameWidth ? offset.x / frameWidth : 0,
        offsetYFrac: frameHeight ? offset.y / frameHeight : 0,
      },
      width: naturalSize.width,
      height: naturalSize.height,
      durationSeconds: duration,
    });
  }

  const displayScale = baseScaleFor(zoom);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="video-frame-dialog-title" className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div ref={dialogRef} tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        <div className="flex items-center justify-between px-2 py-3 text-white">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <h2 id="video-frame-dialog-title" className="text-sm font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!naturalSize}
            aria-label="Use video"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
          >
            <Check className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
          <div
            ref={frameRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative w-full max-w-md touch-none overflow-hidden bg-white/5"
            style={{ aspectRatio: ratio, cursor: "grab" }}
          >
            {videoUrl && (
              <video
                ref={videoRef}
                src={videoUrl}
                muted
                loop
                playsInline
                onLoadedMetadata={handleLoadedMetadata}
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={
                  naturalSize
                    ? {
                        width: naturalSize.width,
                        height: naturalSize.height,
                        transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${displayScale})`,
                      }
                    : undefined
                }
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => handleZoomChange(Number(event.target.value))}
            aria-label="Zoom"
            className="w-full accent-primary"
          />
          <p className="text-center text-xs text-white/60">Drag to reposition, use the slider to zoom</p>
        </div>
      </div>
    </div>
  );
}
