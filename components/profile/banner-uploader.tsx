"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, Plus } from "lucide-react";

import { ImageCropDialog } from "@/components/creator/image-crop-dialog";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const BANNER_CROP_PRESETS = [{ id: "banner", label: "Banner", ratio: 16 / 5 }] as const;

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
      setError("Image must be under 5MB");
      return;
    }

    setPendingFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleCropConfirm({ file }: { file: File; width: number; height: number }) {
    setPendingFile(null);
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

  function handleCropCancel() {
    setPendingFile(null);
  }

  return (
    <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-secondary sm:h-44 md:rounded-3xl">
      {preview ? (
        <Image src={preview} alt="" fill sizes="(min-width: 1024px) 896px, 100vw" className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <ImagePlus className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
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

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

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
          shape="square"
          title="Adjust your banner"
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
