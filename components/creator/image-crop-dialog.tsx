"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

import { IMAGE_CROP_PRESETS } from "@/lib/post-shared";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/use-focus-trap";

const OUTPUT_MAX_DIMENSION = 1440;
/** Widest the frame is ever allowed to render, matching the old `max-w-md` cap on desktop. */
const MAX_FRAME_WIDTH_PX = 448;

type Offset = { x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; startOffset: Offset } | null;
type CropPreset = { id: string; label: string; ratio: number | null };

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
  onError,
  presets = IMAGE_CROP_PRESETS,
  initialPresetId,
  shape = "square",
  title = "Adjust photo",
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (result: { file: File; width: number; height: number }) => void;
  /** Called when the browser can't decode this file (e.g. an unsupported photo format) instead of leaving a stuck, blank dialog. */
  onError?: () => void;
  presets?: readonly CropPreset[];
  initialPresetId?: string;
  shape?: "square" | "circle";
  title?: string;
}) {
  const [presetId, setPresetId] = useState<string>(() =>
    presets.some((preset) => preset.id === initialPresetId) ? initialPresetId! : presets[0].id
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [frameWidth, setFrameWidth] = useState(0);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(true, dialogRef);

  useEffect(() => {
    // Guards every callback below against firing after this effect's own cleanup — e.g. React
    // Strict Mode's mount/cleanup/remount in dev, or a fast re-selection — where revoking the
    // blob URL mid-decode can otherwise fire a spurious `error` on the now-discarded <img>
    // instance and incorrectly abort a perfectly valid photo.
    let cancelled = false;
    let settled = false;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      settled = true;
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      if (cancelled) return;
      settled = true;
      onError?.();
    };
    img.src = url;
    // Neither `load` nor `error` fires reliably for every unsupported/malformed image in every
    // browser — without this, a file that hits neither event leaves the dialog stuck forever
    // with a disabled confirm button and no feedback at all.
    const timeout = window.setTimeout(() => {
      if (!settled && !cancelled) onError?.();
    }, 8000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onError is a stable callback from the caller, not a reactive dependency of loading this file
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

  // Measures the space actually available for the frame (independent of the frame's own
  // size) so the frame can be capped by whichever of width/height is more restrictive —
  // critical for tall ratios like 9:16, which would otherwise grow past the available
  // height and cover the control bar below it.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) =>
      setPreviewSize({ width: entries[0].contentRect.width, height: entries[0].contentRect.height })
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const preset = presets.find((option) => option.id === presetId) ?? presets[0];
  const isCroppable = preset.ratio !== null;
  const targetRatio = preset.ratio ?? (naturalSize ? naturalSize.width / naturalSize.height : 1);
  const frameHeight = frameWidth / targetRatio;
  const fittedFrameWidth =
    previewSize.width > 0 && previewSize.height > 0
      ? Math.min(previewSize.width, MAX_FRAME_WIDTH_PX, previewSize.height * targetRatio)
      : Math.min(previewSize.width || MAX_FRAME_WIDTH_PX, MAX_FRAME_WIDTH_PX);
  const fittedFrameHeight = fittedFrameWidth / targetRatio;

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

    try {
      const img = new window.Image();
      img.src = imageUrl;
      await img.decode();

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
      if (!ctx) throw new Error("2d context unavailable");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("canvas produced no blob");

      onConfirm({
        file: new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }),
        width: outW,
        height: outH,
      });
    } catch {
      onError?.();
    }
  }

  const displayScale = baseScaleFor(zoom);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="crop-dialog-title" className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div ref={dialogRef} tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        <div className="flex items-center justify-between border-b border-white/10 px-2 py-3 text-white">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <h2 id="crop-dialog-title" className="text-sm font-semibold">
            {title}
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

        <div ref={previewRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-5">
          <div
            ref={frameRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative touch-none overflow-hidden bg-white/5"
            style={{
              width: fittedFrameWidth || undefined,
              height: fittedFrameHeight || undefined,
              cursor: isCroppable ? "grab" : "default",
            }}
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
            {shape === "circle" && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
              />
            )}
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-4 border-t border-white/10 bg-black/70 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm">
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
          {presets.length > 1 && (
            <div className="flex items-center justify-center gap-7">
              {presets.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPresetId(option.id)}
                  aria-pressed={presetId === option.id}
                  className={cn(
                    "relative min-h-11 px-1 text-xs font-semibold transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-white after:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none motion-reduce:after:transition-none",
                    presetId === option.id
                      ? "text-white after:scale-x-100"
                      : "text-white/55 hover:text-white"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
