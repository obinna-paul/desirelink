"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropDialog } from "@/components/creator/image-crop-dialog";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_CROP_PRESETS = [{ id: "square", label: "Square", ratio: 1 }] as const;

export function AvatarUploader({
  defaultUrl,
  fallback,
  onUploaded,
}: {
  defaultUrl: string;
  fallback: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(defaultUrl);
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

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload/avatar", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error ?? "Upload failed. Please try again.");
        return;
      }

      onUploaded(body.url);
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
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div className="relative">
        <Avatar className="h-20 w-20 border border-border">
          <AvatarImage src={preview} alt="Avatar preview" />
          <AvatarFallback className="text-lg">{fallback}</AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="h-5 w-5 animate-spin text-neon-pink" />
          </div>
        )}
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-auto">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:rounded-md"
          )}
        >
          <Camera className="h-4 w-4" />
          {uploading ? "Uploading..." : "Change photo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      {pendingFile && (
        <ImageCropDialog
          key={pendingFile.name + pendingFile.lastModified}
          file={pendingFile}
          presets={AVATAR_CROP_PRESETS}
          shape="circle"
          title="Adjust your photo"
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
