"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, Plus } from "lucide-react";

import { ImageCropDialog } from "@/components/creator/image-crop-dialog";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BANNER_CROP_PRESETS = [
  { id: "desktop", label: "Web 16:5", ratio: 16 / 5 },
  { id: "mobile", label: "Mobile 3:1", ratio: 3 },
] as const;
const CROP_SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export function BannerUploader({ bannerUrl }: { bannerUrl: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(bannerUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be under 10 MB");
      return;
    }

    if (CROP_SUPPORTED_TYPES.has(file.type)) {
      setPendingFile(file);
    } else {
      void upload(file);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload(file: File) {
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload/banner", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error ?? "Upload failed. Please try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCropConfirm({ file }: { file: File; width: number; height: number }) {
    setPendingFile(null);
    await upload(file);
  }

  function handleCropCancel() {
    setPendingFile(null);
  }

  return (
    <div className="relative aspect-[3/1] w-full overflow-hidden bg-secondary md:aspect-[16/5]">
      {preview ? (
        <Image src={preview} alt="" fill sizes="(min-width: 1024px) 896px, 100vw" className="object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-muted px-5 text-center">
          <ImagePlus className="h-7 w-7 text-muted-foreground/45" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-muted-foreground">Add a cover photo</p>
          <p className="mt-1 text-[11px] text-muted-foreground/70 md:hidden">
            Best fit on mobile: 3:1, at least 1200 × 400
          </p>
          <p className="mt-1 hidden text-[11px] text-muted-foreground/70 md:block">
            Best fit on web: 16:5, at least 1600 × 500
          </p>
        </div>
      )}

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-neon-pink" aria-hidden="true" />
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "absolute bottom-3 right-3 flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          preview
            ? "bg-background/85 text-foreground hover:bg-background"
            : "bg-foreground text-background hover:bg-foreground/90"
        )}
      >
        {preview ? (
          <>
            <Camera className="h-4 w-4" aria-hidden="true" /> Change banner
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add banner
          </>
        )}
      </button>

      <input ref={inputRef} type="file" accept="image/*,.heic,.heif,.avif" className="hidden" onChange={handleFileChange} />

      {error && (
        <p role="alert" className="absolute bottom-3 left-3 max-w-[60%] rounded-lg bg-background/90 px-2.5 py-1.5 text-xs text-destructive">
          {error}
        </p>
      )}

      {pendingFile && (
        <ImageCropDialog
          key={pendingFile.name + pendingFile.lastModified}
          file={pendingFile}
          presets={BANNER_CROP_PRESETS}
          initialPresetId="desktop"
          shape="square"
          title="Adjust your banner"
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
