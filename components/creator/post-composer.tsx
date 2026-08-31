"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import { AlertTriangle, Image as ImageIcon, Loader2, ShieldCheck, Video, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageCropDialog } from "@/components/creator/image-crop-dialog";
import { VideoFrameDialog } from "@/components/creator/video-frame-dialog";
import {
  MAX_POST_MEDIA_ITEMS,
  POST_ASPECT_RATIOS,
  postAspectRatioValue,
  type PostAspectRatioId,
  type PostMediaItem,
  type VideoCrop,
} from "@/lib/post-shared";
import type { PostView } from "@/lib/posts";
import { detectTextPii, hasImageMetadataSignature, type PiiFinding } from "@/lib/pii";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024;

type LayoutMode = "single" | "carousel";

type UploadedMedia = PostMediaItem & {
  metadataDetected: boolean;
};

type PendingMedia =
  | { kind: "image"; file: File; metadataDetected: boolean }
  | { kind: "video"; file: File };

export function PostComposer({
  creatorDisplayName,
  isProvider = false,
  onCreated,
}: {
  creatorDisplayName: string;
  isProvider?: boolean;
  onCreated: (post: PostView) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("single");
  const [aspectRatioId, setAspectRatioId] = useState<PostAspectRatioId>("portrait");
  const [mediaItems, setMediaItems] = useState<UploadedMedia[]>([]);
  const [isSubscriberOnly, setIsSubscriberOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFindings, setPendingFindings] = useState<PiiFinding[]>([]);
  const [showPiiWarning, setShowPiiWarning] = useState(false);
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);
  const [mediaQueue, setMediaQueue] = useState<PendingMedia[]>([]);
  const piiDialogRef = useRef<HTMLDivElement>(null);

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

  const aspectRatioValue = postAspectRatioValue(aspectRatioId);
  const imageCropPresets = useMemo(
    () => [{ id: aspectRatioId, label: POST_ASPECT_RATIOS.find((option) => option.id === aspectRatioId)!.label, ratio: aspectRatioValue }],
    [aspectRatioId, aspectRatioValue]
  );

  const mediaPayload = useMemo(
    () =>
      mediaItems.map((item) => ({
        url: item.url,
        type: item.type,
        width: item.width,
        height: item.height,
        durationSeconds: item.durationSeconds,
        crop: item.crop,
      })),
    [mediaItems]
  );
  const strippedImageCount = useMemo(
    () => mediaItems.filter((image) => image.metadataDetected).length,
    [mediaItems]
  );

  async function uploadFile(file: File, metadataDetected: boolean, crop?: VideoCrop) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/post-media", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Upload failed. Please try again.");
        return;
      }
      setMediaItems((prev) => [...prev, { ...body.media, metadataDetected, crop }]);
    } catch {
      setError("Upload failed. Please try again.");
    }
  }

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const limit = layoutMode === "single" ? 1 : MAX_POST_MEDIA_ITEMS;
    if (mediaItems.length + mediaQueue.length + files.length > limit) {
      setError(
        layoutMode === "single"
          ? "A single post can only have one photo or video. Switch to Carousel to add more."
          : `Up to ${MAX_POST_MEDIA_ITEMS} media items per post.`
      );
      event.target.value = "";
      return;
    }

    setError(null);

    const queued: PendingMedia[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        setError("Please choose image or video files only.");
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
        queued.push({ kind: "video", file });
        continue;
      }

      // Future vision-based PII scanning can run here before upload.
      const metadataDetected = hasImageMetadataSignature(await file.arrayBuffer());
      queued.push({ kind: "image", file, metadataDetected });
    }

    // Every photo and video goes through the frame/adjust screen, cropped to the post's
    // chosen dimension - this is what keeps the feed WYSIWYG with what was previewed here.
    if (queued.length > 0) {
      setMediaQueue((prev) => [...prev, ...queued]);
    }

    event.target.value = "";
  }

  async function handleImageCropConfirm({ file }: { file: File }) {
    const metadataDetected = mediaQueue[0]?.kind === "image" ? mediaQueue[0].metadataDetected : false;
    setMediaQueue((prev) => prev.slice(1));
    setUploading(true);
    await uploadFile(file, metadataDetected);
    setUploading(false);
  }

  async function handleVideoFrameConfirm({ crop }: { crop: VideoCrop; width: number; height: number; durationSeconds: number }) {
    const current = mediaQueue[0];
    setMediaQueue((prev) => prev.slice(1));
    if (current?.kind !== "video") return;
    setUploading(true);
    await uploadFile(current.file, false, crop);
    setUploading(false);
  }

  function handleQueueCancel() {
    setMediaQueue((prev) => prev.slice(1));
  }

  function removeImage(url: string) {
    setMediaItems((prev) => prev.filter((existing) => existing.url !== url));
  }

  function changeLayoutMode(mode: LayoutMode) {
    setLayoutMode(mode);
    if (mode === "single" && mediaItems.length > 1) {
      setMediaItems((prev) => prev.slice(0, 1));
    }
  }

  function changeAspectRatio(id: PostAspectRatioId) {
    setAspectRatioId(id);
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
        aspectRatio: aspectRatioId,
        isSubscriberOnly: isProvider && isSubscriberOnly,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't publish post. Please try again.");
      return;
    }

    const { post } = await res.json();
    onCreated(post);
    setContent("");
    setMediaItems([]);
    setIsSubscriberOnly(false);
    setLayoutMode("single");
    setPiiAcknowledged(false);
    setPendingFindings([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!content.trim() && mediaPayload.length === 0) {
      setError("Write something or add media.");
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

  const hasMedia = mediaItems.length > 0 || mediaQueue.length > 0;
  const nextQueued = mediaQueue[0];

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card md:rounded-xl md:p-4 md:shadow-none"
    >
      <label htmlFor="post-content" className="sr-only">
        Post content
      </label>
      <Textarea
        id="post-content"
        rows={3}
        maxLength={2000}
        placeholder="Share something..."
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setPiiAcknowledged(false);
        }}
        className="min-h-28 resize-none rounded-2xl text-base md:rounded-md md:text-sm"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="label-caps text-[10px] text-muted-foreground">Layout</span>
          <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
            {(["single", "carousel"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={layoutMode === mode}
                onClick={() => changeLayoutMode(mode)}
                className={cn(
                  "label-caps min-h-10 rounded-full text-[11px] transition-colors",
                  layoutMode === mode ? "bg-card text-primary shadow-card" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mode === "single" ? "Single" : "Carousel"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <span className="label-caps text-[10px] text-muted-foreground">Dimensions</span>
          <div className="grid grid-cols-3 gap-2 rounded-full bg-muted p-1">
            {POST_ASPECT_RATIOS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={aspectRatioId === option.id}
                disabled={hasMedia}
                onClick={() => changeAspectRatio(option.id)}
                className={cn(
                  "label-caps min-h-10 rounded-full text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  aspectRatioId === option.id ? "bg-card text-primary shadow-card" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {hasMedia && (
            <p className="text-[11px] text-muted-foreground">Remove your media to change dimensions.</p>
          )}
        </div>
      </div>

      {isProvider && (
        <div className="flex flex-col gap-1.5">
          <span className="label-caps text-[10px] text-muted-foreground">Audience</span>
          <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
            <button
              type="button"
              aria-pressed={!isSubscriberOnly}
              onClick={() => setIsSubscriberOnly(false)}
              className={cn(
                "label-caps min-h-10 rounded-full text-[11px] transition-colors",
                !isSubscriberOnly ? "bg-card text-primary shadow-card" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Free
            </button>
            <button
              type="button"
              aria-pressed={isSubscriberOnly}
              onClick={() => setIsSubscriberOnly(true)}
              className={cn(
                "label-caps min-h-10 rounded-full text-[11px] transition-colors",
                isSubscriberOnly ? "bg-card text-primary shadow-card" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Premium
            </button>
          </div>
        </div>
      )}

      {(strippedImageCount > 0 || mediaItems.length > 0) && (
        <div className="flex items-start gap-2 rounded-2xl border border-border bg-muted/60 p-3 text-xs text-muted-foreground md:rounded-lg">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-trust" aria-hidden="true" />
          <p>
            {strippedImageCount > 0
              ? `${strippedImageCount} uploaded ${strippedImageCount === 1 ? "image had" : "images had"} metadata markers and ${strippedImageCount === 1 ? "was" : "were"} re-encoded before upload.`
              : "Images are re-encoded before upload to remove common metadata. Videos are stored without EXIF stripping."}
          </p>
        </div>
      )}

      {mediaItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {mediaItems.map((item) => (
            <div
              key={item.url}
              className="relative w-full overflow-hidden rounded-2xl border border-border bg-secondary sm:h-20 sm:w-20 sm:rounded-lg"
              style={{ aspectRatio: aspectRatioValue }}
            >
              {item.type === "video" ? (
                <div className="flex h-full w-full items-center justify-center bg-black text-white">
                  <Video className="h-6 w-6" aria-hidden="true" />
                </div>
              ) : (
                <NextImage src={item.url} alt="" fill sizes="5rem" className="object-cover" />
              )}
              <button
                type="button"
                aria-label="Remove media"
                onClick={() => removeImage(item.url)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={
            uploading ||
            mediaItems.length + mediaQueue.length >= (layoutMode === "single" ? 1 : MAX_POST_MEDIA_ITEMS)
          }
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:rounded-md"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
          )}
          {uploading ? "Uploading..." : "Add from gallery"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          multiple={layoutMode === "carousel"}
          className="hidden"
          onChange={handleFiles}
        />
        <Button type="submit" disabled={submitting || uploading} className="w-full md:w-auto">
          {submitting ? "Publishing..." : "Publish"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {showPiiWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div
            ref={piiDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pii-warning-title"
            aria-describedby="pii-warning-description"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg focus:outline-none md:rounded-xl"
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
                  This post may include identifying details. Remove anything you do not want shared publicly or with Fans.
                </p>
              </div>
            </div>

            <ul className="mt-4 flex flex-col gap-2">
              {pendingFindings.map((finding) => (
                <li
                  key={finding.type}
                  className="flex items-center justify-between rounded-2xl border border-border bg-background/40 px-3 py-2 text-sm md:rounded-lg"
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
    </form>

    {nextQueued?.kind === "image" && (
      <ImageCropDialog
        key={nextQueued.file.name + nextQueued.file.lastModified}
        file={nextQueued.file}
        presets={imageCropPresets}
        onCancel={handleQueueCancel}
        onConfirm={handleImageCropConfirm}
      />
    )}
    {nextQueued?.kind === "video" && (
      <VideoFrameDialog
        key={nextQueued.file.name + nextQueued.file.lastModified}
        file={nextQueued.file}
        ratio={aspectRatioValue}
        onCancel={handleQueueCancel}
        onConfirm={handleVideoFrameConfirm}
      />
    )}
    </>
  );
}
