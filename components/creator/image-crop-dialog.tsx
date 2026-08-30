"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

import { IMAGE_CROP_PRESETS, type ImageCropPresetId } from "@/lib/post-shared";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/use-focus-trap";

const OUTPUT_MAX_DIMENSION = 1440;

type Offset = { x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; startOffset: Offset } | null;

/**
 * Instagram-style "pick a ratio, then pan/zoom to fit" cropper. The image
 * always fills the frame (cover); confirming maps the visible window back to
 * the original image's pixel coordinates and draws just that region onto a
 * canvas, which both crops and re-encodes (stripping metadata) in one pass.
 */
export function ImageCropDialog({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (result: { file: File; width: number; height: number }) => void;
}) {
  const [presetId, setPresetId] = useState<ImageCropPresetId>("original");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [frameWidth, setFrameWidth] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(true, dialogRef);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new window.Image();
    img.onload = () => setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
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

  const preset = IMAGE_CROP_PRESETS.find((option) => option.id === presetId) ?? IMAGE_CROP_PRESETS[0];
  const isCroppable = preset.ratio !== null;
  const targetRatio = preset.ratio ?? (naturalSize ? naturalSize.width / naturalSize.height : 1);
  const frameHeight = frameWidth / targetRatio;

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [presetId]);

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
    if (!isCroppable) return;
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

  async function handleConfirm() {
    if (!naturalSize || !imageUrl) return;

    const img = new window.Image();
    img.src = imageUrl;
    await img.decode().catch(() => {});

    let sx = 0;
    let sy = 0;
    let sw = naturalSize.width;
    let sh = naturalSize.height;

    if (isCroppable && frameWidth) {
      const scale = baseScaleFor(zoom);
      const dispW = naturalSize.width * scale;
      const dispH = naturalSize.height * scale;
      const imgLeft = (frameWidth - dispW) / 2 + offset.x;
      const imgTop = (frameHeight - dispH) / 2 + offset.y;
      sx = -imgLeft / scale;
      sy = -imgTop / scale;
      sw = frameWidth / scale;
      sh = frameHeight / scale;
    }

    const outW = Math.max(1, Math.min(OUTPUT_MAX_DIMENSION, Math.round(sw)));
    const outH = Math.max(1, Math.round(outW / (sw / sh)));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;

    onConfirm({
      file: new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }),
      width: outW,
      height: outH,
    });
  }

  const displayScale = baseScaleFor(zoom);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="crop-dialog-title" className="fixed inset-0 z-[60] flex flex-col bg-black">
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
          <h2 id="crop-dialog-title" className="text-sm font-semibold">
            Adjust photo
          </h2>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!naturalSize}
            aria-label="Use photo"
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
            style={{ aspectRatio: targetRatio, cursor: isCroppable ? "grab" : "default" }}
          >
            {imageUrl && naturalSize && frameWidth > 0 && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview with a live pan/zoom transform; next/image's wrapper doesn't fit this interaction and there's no remote optimization to gain
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: naturalSize.width,
                  height: naturalSize.height,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${displayScale})`,
                }}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
          {isCroppable && (
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
          )}
          <div className="flex items-center justify-center gap-2">
            {IMAGE_CROP_PRESETS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPresetId(option.id)}
                aria-pressed={presetId === option.id}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  presetId === option.id ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
