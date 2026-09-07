"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, Plus } from "lucide-react";

import { ImageCropDialog } from "@/components/creator/image-crop-dialog";
import { EditableImageError, prepareEditableImage } from "@/lib/editable-image";
import { cn } from "@/lib/utils";

const BANNER_CROP_PRESETS = [
  { id: "desktop", label: "Web 16:5", ratio: 16 / 5 },
  { id: "mobile", label: "Mobile 3:1", ratio: 3 },
] as const;

export function BannerUploader({ bannerUrl }: { bannerUrl: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(bannerUrl);
  const [uploading, setUploading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";

    setError(null);
    setPreparing(true);
    try {
      setPendingFile(await prepareEditableImage(file));
    } catch (error) {
      setError(error instanceof EditableImageError ? error.message : "This photo could not be prepared. Try again.");
    } finally {
      setPreparing(false);
    }
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

  function handleCropError() {
    setPendingFile(null);
    setError("The banner preview was interrupted. Choose the photo again to retry.");
  }

  return (
    <div className="relative aspect-[3/1] w-full overflow-hidden bg-secondary sm:rounded-t-2xl md:aspect-[16/5]">
      {preview ? (
        <Image
          src={preview}
          alt=""
          fill
          sizes="(min-width: 1024px) 896px, 100vw"
          className="object-cover"
          onError={() => {
            setPreview("");
            setError("This photo couldn't be displayed. Please try a different one.");
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <ImagePlus className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
        </div>
      )}

      <p className="absolute right-3 top-2 text-right text-[9px] font-medium leading-tight text-muted-foreground/60">
        <span className="md:hidden">3:1, 1200×400+</span>
        <span className="hidden md:inline">16:5, 1600×500+</span>
      </p>

      {(uploading || preparing) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-neon-pink" aria-hidden="true" />
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || preparing}
        className={cn(
          "absolute bottom-2 right-2 flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          preview
            ? "bg-background/85 text-foreground hover:bg-background"
            : "bg-foreground text-background hover:bg-foreground/90"
        )}
      >
        {preview ? (
          <>
            <Camera className="h-3 w-3" aria-hidden="true" /> Change
          </>
        ) : (
          <>
            <Plus className="h-3 w-3" aria-hidden="true" /> Banner
          </>
        )}
      </button>

      <input ref={inputRef} type="file" accept="image/*,.heic,.heif,.avif,.bmp" className="hidden" onChange={handleFileChange} />

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
          onError={handleCropError}
        />
      )}
    </div>
  );
}
