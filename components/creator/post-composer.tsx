"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, GalleryHorizontal, ImagePlus, Loader2, Lock, ShieldCheck, Video, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageCropDialog } from "@/components/creator/image-crop-dialog";
import {
  MAX_POST_MEDIA_ITEMS,
  POST_DISPLAY_RATIO_OPTIONS,
  type PostDisplayAspectRatio,
  type PostMediaItem,
} from "@/lib/post-shared";
import type { PostView } from "@/lib/posts";
import { detectTextPii, hasImageMetadataSignature, type PiiFinding } from "@/lib/pii";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024;

type UploadedMedia = PostMediaItem & {
  metadataDetected: boolean;
};

type PendingCrop = { file: File; metadataDetected: boolean };
type PostMode = "single" | "carousel";
type PostAccess = "free" | "premium";

const DEFAULT_DISPLAY_RATIO: PostDisplayAspectRatio = "square";

function selectedRatioValue(value: PostDisplayAspectRatio) {
  return POST_DISPLAY_RATIO_OPTIONS.find((option) => option.value === value)?.ratio ?? 1;
}

export function PostComposer({
  creatorDisplayName,
  allowPremiumContent = false,
  onCreated,
}: {
  creatorDisplayName: string;
  allowPremiumContent?: boolean;
  onCreated: (post: PostView) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const piiDialogRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [postMode, setPostMode] = useState<PostMode>("single");
  const [displayAspectRatio, setDisplayAspectRatioState] = useState<PostDisplayAspectRatio>(DEFAULT_DISPLAY_RATIO);
  const [mediaItems, setMediaItems] = useState<UploadedMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [postAccess, setPostAccess] = useState<PostAccess>("free");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFindings, setPendingFindings] = useState<PiiFinding[]>([]);
  const [showPiiWarning, setShowPiiWarning] = useState(false);
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);
  const [cropQueue, setCropQueue] = useState<PendingCrop[]>([]);

  useFocusTrap(showPiiWarning, piiDialogRef);

  useEffect(() => {
    if (!showPiiWarning) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setShowPiiWarning(false);
      setPiiAcknowledged(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showPiiWarning]);

  useEffect(() => {
    if (activeMediaIndex > mediaItems.length - 1) {
      setActiveMediaIndex(Math.max(0, mediaItems.length - 1));
    }
  }, [activeMediaIndex, mediaItems.length]);

  const selectedRatio = selectedRatioValue(displayAspectRatio);
  const mediaPayload = useMemo(
    () =>
      mediaItems.map((item) => ({
        url: item.url,
        type: item.type,
        width: item.width,
        height: item.height,
        durationSeconds: item.durationSeconds,
        displayAspectRatio,
      })),
    [displayAspectRatio, mediaItems]
  );
  const strippedImageCount = useMemo(
    () => mediaItems.filter((image) => image.metadataDetected).length,
    [mediaItems]
  );
  const activeMedia = mediaItems[activeMediaIndex];
  const isSubscriberOnly = allowPremiumContent && postAccess === "premium";

  function setDisplayAspectRatio(value: PostDisplayAspectRatio) {
    setDisplayAspectRatioState(value);
    setMediaItems((current) => current.map((item) => ({ ...item, displayAspectRatio: value })));
  }

  function setMode(nextMode: PostMode) {
    setPostMode(nextMode);
    setError(null);
    if (nextMode === "single" && mediaItems.length > 1) {
      setMediaItems((current) => current.slice(0, 1));
      setActiveMediaIndex(0);
    }
  }

  async function uploadFile(file: File, metadataDetected: boolean) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/post-media", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Upload failed. Please try again.");
        return;
      }

      setMediaItems((prev) => [
        ...prev,
        {
          ...body.media,
          displayAspectRatio,
          metadataDetected,
        },
      ]);
    } catch {
      setError("Upload failed. Please try again.");
    }
  }

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (postMode === "single" && (files.length > 1 || mediaItems.length >= 1 || cropQueue.length >= 1)) {
      setError("Single posts can use one photo or video. Switch to carousel for multiple media.");
      event.target.value = "";
      return;
    }

    if (mediaItems.length + cropQueue.length + files.length > MAX_POST_MEDIA_ITEMS) {
      setError(`Up to ${MAX_POST_MEDIA_ITEMS} media items per carousel.`);
      event.target.value = "";
      return;
    }

    setError(null);

    const videosToUpload: File[] = [];
    const imagesToReview: PendingCrop[] = [];

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        setError("Choose image or video files only.");
        continue;
      }
      if (isImage && file.size > MAX_IMAGE_FILE_SIZE) {
        setError("Each image must be under 8MB.");
        continue;
      }
      if (isVideo && file.size > MAX_VIDEO_FILE_SIZE) {
        setError("Each video must be under 100MB.");
        continue;
      }

      if (isVideo) {
        videosToUpload.push(file);
        continue;
      }

      const metadataDetected = hasImageMetadataSignature(await file.arrayBuffer());
      imagesToReview.push({ file, metadataDetected });
    }

    if (videosToUpload.length > 0) {
      setUploading(true);
      for (const file of videosToUpload) {
        await uploadFile(file, false);
      }
      setUploading(false);
    }

    if (imagesToReview.length > 0) {
      setCropQueue((prev) => [...prev, ...imagesToReview]);
    }

    event.target.value = "";
  }

  async function handleCropConfirm({ file }: { file: File }) {
    const metadataDetected = cropQueue[0]?.metadataDetected ?? false;
    setCropQueue((prev) => prev.slice(1));
    setUploading(true);
    await uploadFile(file, metadataDetected);
    setUploading(false);
  }

  function handleCropCancel() {
    setCropQueue((prev) => prev.slice(1));
  }

  function removeMedia(url: string) {
    setMediaItems((prev) => prev.filter((existing) => existing.url !== url));
  }

  async function publishPost() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content.trim(),
        mediaItems: mediaPayload,
        isSubscriberOnly,
        postType: "standard",
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't publish post. Please try again.");
      return;
    }

    const { post } = await res.json();
    if (post) onCreated(post);
    setContent("");
    setMediaItems([]);
    setActiveMediaIndex(0);
    setPostMode("single");
    setPostAccess("free");
    setPiiAcknowledged(false);
    setPendingFindings([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!content.trim() && mediaPayload.length === 0) {
      setError("Write a caption or add media.");
      return;
    }

    const findings = detectTextPii(content, [creatorDisplayName]);
    if (findings.length > 0 && !piiAcknowledged) {
      setPendingFindings(findings);
      setShowPiiWarning(true);
      return;
    }

    await publishPost();
  }

  async function continueAfterWarning() {
    setPiiAcknowledged(true);
    setShowPiiWarning(false);
    await publishPost();
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-[28px] border border-border bg-card shadow-card md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] md:rounded-2xl"
      >
        <section className="border-b border-border bg-black p-3 text-white md:border-b-0 md:border-r md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/55">Preview</p>
              <p className="mt-1 text-sm text-white/75">
                {mediaItems.length > 1 ? `${mediaItems.length} media carousel` : mediaItems.length === 1 ? "Single media post" : "Choose media"}
              </p>
            </div>
            {mediaItems.length > 0 && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                {POST_DISPLAY_RATIO_OPTIONS.find((option) => option.value === displayAspectRatio)?.helper}
              </span>
            )}
          </div>

          <div
            className="mt-4 flex w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
            style={{ aspectRatio: selectedRatio }}
          >
            {activeMedia ? (
              activeMedia.type === "video" ? (
                <video
                  src={activeMedia.url}
                  controls
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="relative h-full w-full">
                  <Image
                    src={activeMedia.url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex min-h-[260px] w-full flex-col items-center justify-center gap-3 px-6 text-center text-white/70 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black">
                  <ImagePlus className="h-6 w-6" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">Open gallery</span>
                  <span className="mt-1 block text-xs leading-5 text-white/55">
                    Choose a photo, video, or a carousel from this device.
                  </span>
                </span>
              </button>
            )}
          </div>

          {mediaItems.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {mediaItems.map((item, index) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => setActiveMediaIndex(index)}
                  aria-label={`Preview media ${index + 1}`}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white/10 transition-colors",
                    activeMediaIndex === index ? "border-white" : "border-white/15"
                  )}
                >
                  {item.type === "video" ? (
                    <span className="flex h-full w-full items-center justify-center">
                      <Video className="h-5 w-5" aria-hidden="true" />
                    </span>
                  ) : (
                    <Image src={item.url} alt="" fill sizes="4rem" className="object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5 p-4 md:p-5">
          <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
            <button
              type="button"
              aria-pressed={postMode === "single"}
              onClick={() => setMode("single")}
              className={cn(
                "min-h-11 rounded-full text-sm font-semibold transition-colors",
                postMode === "single" ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Single
            </button>
            <button
              type="button"
              aria-pressed={postMode === "carousel"}
              onClick={() => setMode("carousel")}
              className={cn(
                "min-h-11 rounded-full text-sm font-semibold transition-colors",
                postMode === "carousel" ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Carousel
            </button>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Frame</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Pick the shape that matches your media before posting.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {POST_DISPLAY_RATIO_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={displayAspectRatio === option.value}
                  onClick={() => setDisplayAspectRatio(option.value)}
                  className={cn(
                    "flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-center transition-colors",
                    displayAspectRatio === option.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "flex w-8 items-center justify-center rounded border",
                      displayAspectRatio === option.value ? "border-background/40" : "border-border"
                    )}
                    style={{ aspectRatio: option.ratio }}
                    aria-hidden="true"
                  >
                    {displayAspectRatio === option.value && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span>
                    <span className="block text-xs font-semibold">{option.label}</span>
                    <span className="block text-[11px] opacity-70">{option.helper}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || mediaItems.length >= (postMode === "single" ? 1 : MAX_POST_MEDIA_ITEMS)}
              className="h-12 w-full justify-center gap-2 rounded-2xl"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <GalleryHorizontal className="h-4 w-4" aria-hidden="true" />
              )}
              {uploading ? "Uploading..." : mediaItems.length > 0 ? "Add more media" : "Open gallery"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              multiple={postMode === "carousel"}
              className="hidden"
              onChange={handleFiles}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Your browser will ask for gallery access when needed. Images are re-encoded before upload.
            </p>
          </div>

          {mediaItems.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {mediaItems.map((item, index) => (
                <span
                  key={item.url}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-background px-2.5 text-xs font-semibold"
                >
                  {item.type === "video" ? <Video className="h-3.5 w-3.5" aria-hidden="true" /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />}
                  {item.type === "video" ? "Video" : "Photo"} {index + 1}
                  <button
                    type="button"
                    aria-label={`Remove media ${index + 1}`}
                    onClick={() => removeMedia(item.url)}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div>
            <label htmlFor="post-content" className="text-sm font-semibold text-foreground">
              Caption
            </label>
            <Textarea
              id="post-content"
              rows={5}
              maxLength={2000}
              placeholder="Write a caption..."
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setPiiAcknowledged(false);
              }}
              className="mt-2 min-h-32 resize-none rounded-2xl text-base md:text-sm"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{content.length}/2000</p>
          </div>

          {allowPremiumContent && (
            <div className="rounded-2xl border border-border bg-background/60 p-3">
              <p className="text-sm font-semibold text-foreground">Content access</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  { value: "free", label: "Free", helper: "Appears in the public feed" },
                  { value: "premium", label: "Premium", helper: "Goes under the Premium tab" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={postAccess === option.value}
                    onClick={() => setPostAccess(option.value)}
                    className={cn(
                      "min-h-[74px] rounded-2xl border px-3 text-left transition-colors",
                      postAccess === option.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {option.value === "premium" && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                      {option.label}
                    </span>
                    <span className={cn("mt-1 block text-xs leading-5", postAccess === option.value ? "text-background/75" : "text-muted-foreground")}>
                      {option.helper}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(strippedImageCount > 0 || mediaItems.length > 0) && (
            <div className="flex items-start gap-2 rounded-2xl border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-trust" aria-hidden="true" />
              <p>
                {strippedImageCount > 0
                  ? `${strippedImageCount} uploaded ${strippedImageCount === 1 ? "image had" : "images had"} metadata markers and ${strippedImageCount === 1 ? "was" : "were"} re-encoded before upload.`
                  : "Images are re-encoded before upload to remove common metadata. Videos are stored without EXIF stripping."}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="sticky bottom-3 z-10 rounded-2xl border border-border bg-card/95 p-2 shadow-lift backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <Button type="submit" disabled={submitting || uploading} className="h-12 w-full rounded-2xl">
              {submitting ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </section>
      </form>

      {showPiiWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div
            ref={piiDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pii-warning-title"
            aria-describedby="pii-warning-description"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg focus:outline-none"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="pii-warning-title" className="text-base font-semibold">
                  Review possible personal info
                </h2>
                <p id="pii-warning-description" className="mt-1 text-sm text-muted-foreground">
                  This post may include identifying details. Remove anything you do not want shared.
                </p>
              </div>
            </div>

            <ul className="mt-4 flex flex-col gap-2">
              {pendingFindings.map((finding) => (
                <li
                  key={finding.type}
                  className="flex items-center justify-between rounded-2xl border border-border bg-background/40 px-3 py-2 text-sm"
                >
                  <span>{finding.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {finding.count} {finding.count === 1 ? "match" : "matches"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setShowPiiWarning(false);
                  setPiiAcknowledged(false);
                }}
              >
                Edit post
              </Button>
              <Button type="button" onClick={continueAfterWarning} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Publishing..." : "Publish anyway"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {cropQueue.length > 0 && (
        <ImageCropDialog
          key={cropQueue[0].file.name + cropQueue[0].file.lastModified}
          file={cropQueue[0].file}
          title="Frame photo"
          initialPresetId={displayAspectRatio}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </>
  );
}
