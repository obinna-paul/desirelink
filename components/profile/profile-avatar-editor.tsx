"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceRing } from "@/components/ui/presence-avatar";
import { ImageCropDialog } from "@/components/creator/image-crop-dialog";
import { ImageViewerDialog } from "@/components/profile/image-viewer-dialog";
import type { PresenceStatus } from "@/lib/presence";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const AVATAR_CROP_PRESETS = [{ id: "square", label: "Square", ratio: 1 }] as const;
const CROP_SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export function ProfileAvatarEditor({
  avatarUrl,
  displayName,
  descriptor,
  isOwner,
  presenceStatus = "offline",
  liveStreamId = null,
}: {
  avatarUrl: string;
  displayName: string;
  descriptor: string;
  isOwner: boolean;
  presenceStatus?: PresenceStatus;
  liveStreamId?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(avatarUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload/avatar", { method: "POST", body: formData });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? "We couldn't update your photo. Try again.");
        return;
      }

      setPreview(body.url);
      router.refresh();
    } catch {
      setError("We couldn't update your photo. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Choose a photo file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Photo must be under 10 MB.");
      return;
    }

    if (CROP_SUPPORTED_TYPES.has(file.type)) {
      setPendingFile(file);
      return;
    }

    void upload(file);
  }

  const avatarInner = (
    <PresenceRing status={presenceStatus} size="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32">
      <Avatar className="h-full w-full border-2 border-card bg-avatar-placeholder shadow-lift">
        <AvatarImage src={preview} alt={displayName} className="object-cover" />
        <AvatarFallback className="text-xl md:text-2xl">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </PresenceRing>
  );

  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative">
        {presenceStatus === "live" && liveStreamId ? (
          <Link
            href={`/live/${liveStreamId}`}
            aria-label={`${displayName} is live - tap to watch`}
            className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {avatarInner}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => preview && setShowFullView(true)}
            aria-label={`View ${displayName}'s profile photo`}
            className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {avatarInner}
          </button>
        )}

        {isOwner && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Change profile photo"
            className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-card bg-foreground text-background shadow-sm transition-colors hover:bg-foreground/85 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      <p className="mt-2 max-w-[10rem] truncate text-center text-xs font-medium text-muted-foreground">
        {descriptor}
      </p>

      {isOwner && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif,.avif"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {error && (
        <p role="alert" className="mt-1 max-w-40 text-center text-xs text-destructive">
          {error}
        </p>
      )}

      {pendingFile && (
        <ImageCropDialog
          key={`${pendingFile.name}-${pendingFile.lastModified}`}
          file={pendingFile}
          presets={AVATAR_CROP_PRESETS}
          shape="circle"
          title="Adjust profile photo"
          onCancel={() => setPendingFile(null)}
          onConfirm={({ file }) => {
            setPendingFile(null);
            void upload(file);
          }}
          onError={() => {
            setPendingFile(null);
            setError("This photo couldn't be opened. Try a different one, or convert it to JPEG or PNG first.");
          }}
        />
      )}

      {showFullView && preview && (
        <ImageViewerDialog src={preview} alt={`${displayName}'s profile photo`} onClose={() => setShowFullView(false)} />
      )}
    </div>
  );
}
