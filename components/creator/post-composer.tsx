"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ImagePlus,
  Loader2,
  Lock,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageCropDialog } from "@/components/creator/image-crop-dialog";
import { VideoFrameDialog } from "@/components/creator/video-frame-dialog";
import { ProviderUpgradePrompt } from "@/components/settings/provider-upgrade-prompt";
import { VerificationRequestCard } from "@/components/verification/verification-request-card";
import { PostVideoPlayer } from "@/components/posts/post-video-player";
import {
  MAX_POST_MEDIA_ITEMS,
  POST_DISPLAY_RATIO_OPTIONS,
  type PostDisplayAspectRatio,
  type PostMediaItem,
  type VideoCrop,
} from "@/lib/post-shared";
import type { PostView } from "@/lib/posts";
import {
  detectTextPii,
  hasImageMetadataSignature,
  type PiiFinding,
} from "@/lib/pii";
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
  return (
    POST_DISPLAY_RATIO_OPTIONS.find((option) => option.value === value)
      ?.ratio ?? 1
  );
}

export function PostComposer({
  creatorDisplayName,
  canPostPremiumContent = false,
  hasIdentityOnFile = false,
  onCreated,
}: {
  creatorDisplayName: string;
  canPostPremiumContent?: boolean;
  hasIdentityOnFile?: boolean;
  onCreated: (post: PostView) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const piiDialogRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [postMode, setPostMode] = useState<PostMode>("single");
  const [displayAspectRatio, setDisplayAspectRatioState] =
    useState<PostDisplayAspectRatio>(DEFAULT_DISPLAY_RATIO);
  const [mediaItems, setMediaItems] = useState<UploadedMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [postAccess, setPostAccess] = useState<PostAccess>("free");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProviderUpgradePrompt, setShowProviderUpgradePrompt] =
    useState(false);
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [identitySubmittedLocally, setIdentitySubmittedLocally] =
    useState(false);
  const [pendingFindings, setPendingFindings] = useState<PiiFinding[]>([]);
  const [showPiiWarning, setShowPiiWarning] = useState(false);
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);
  const [cropQueue, setCropQueue] = useState<PendingCrop[]>([]);
  const [videoQueue, setVideoQueue] = useState<File[]>([]);

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
        crop: item.crop,
      })),
    [displayAspectRatio, mediaItems],
  );
  const strippedImageCount = useMemo(
    () => mediaItems.filter((image) => image.metadataDetected).length,
    [mediaItems],
  );
  const activeMedia = mediaItems[activeMediaIndex];
  const canGoPremium = hasIdentityOnFile || identitySubmittedLocally;
  const isSubscriberOnly = canPostPremiumContent && postAccess === "premium";
  const selectedRatioOption = POST_DISPLAY_RATIO_OPTIONS.find(
    (option) => option.value === displayAspectRatio,
  );
  const mediaLimit = postMode === "single" ? 1 : MAX_POST_MEDIA_ITEMS;
  const canAddMedia = mediaItems.length < mediaLimit;

  function setDisplayAspectRatio(value: PostDisplayAspectRatio) {
    setDisplayAspectRatioState(value);
    setMediaItems((current) =>
      current.map((item) => ({ ...item, displayAspectRatio: value })),
    );
  }

  function setMode(nextMode: PostMode) {
    setPostMode(nextMode);
    setError(null);
    if (nextMode === "single" && mediaItems.length > 1) {
      setMediaItems((current) => current.slice(0, 1));
      setActiveMediaIndex(0);
    }
  }

  async function uploadFile(
    file: File,
    metadataDetected: boolean,
    crop?: VideoCrop,
  ) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/post-media", {
        method: "POST",
        body: formData,
      });
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
          crop,
        },
      ]);
    } catch {
      setError("Upload failed. Please try again.");
    }
  }

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (
      postMode === "single" &&
      (files.length > 1 ||
        mediaItems.length >= 1 ||
        cropQueue.length >= 1 ||
        videoQueue.length >= 1)
    ) {
      setError(
        "Single posts can use one photo or video. Switch to carousel for multiple media.",
      );
      event.target.value = "";
      return;
    }

    if (
      mediaItems.length + cropQueue.length + videoQueue.length + files.length >
      MAX_POST_MEDIA_ITEMS
    ) {
      setError(`Up to ${MAX_POST_MEDIA_ITEMS} media items per carousel.`);
      event.target.value = "";
      return;
    }

    setError(null);

    const videosToReview: File[] = [];
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
        videosToReview.push(file);
        continue;
      }

      const metadataDetected = hasImageMetadataSignature(
        await file.arrayBuffer(),
      );
      imagesToReview.push({ file, metadataDetected });
    }

    // Every photo and video goes through the frame/adjust screen, cropped to the post's
    // chosen dimension - this is what keeps the feed WYSIWYG with what was previewed here.
    if (imagesToReview.length > 0) {
      setCropQueue((prev) => [...prev, ...imagesToReview]);
    }
    if (videosToReview.length > 0) {
      setVideoQueue((prev) => [...prev, ...videosToReview]);
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

  function handleCropError() {
    setCropQueue((prev) => prev.slice(1));
    setError(
      "A photo couldn't be opened. Try a different one, or convert it to JPEG or PNG first.",
    );
  }

  async function handleVideoFrameConfirm({
    crop,
  }: {
    crop: VideoCrop;
    width: number;
    height: number;
    durationSeconds: number;
  }) {
    const file = videoQueue[0];
    setVideoQueue((prev) => prev.slice(1));
    if (!file) return;
    setUploading(true);
    await uploadFile(file, false, crop);
    setUploading(false);
  }

  function handleVideoFrameCancel() {
    setVideoQueue((prev) => prev.slice(1));
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
      setError("Share something or add media before publishing.");
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

  const modeControls = (
    <div
      className="flex border-b border-border/80"
      role="group"
      aria-label="Post format"
    >
      {(
        [
          { value: "single", label: "Single post" },
          { value: "carousel", label: "Carousel" },
        ] as const
      ).map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={postMode === option.value}
          onClick={() => setMode(option.value)}
          className={cn(
            "relative min-h-12 flex-1 px-4 text-sm font-semibold transition-colors after:absolute after:inset-x-5 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-foreground after:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none motion-reduce:after:transition-none",
            postMode === option.value
              ? "text-foreground after:scale-x-100"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const frameControls = (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">Frame</legend>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Choose how your photos and videos will appear in the feed.
      </p>
      <div className="mt-3 flex items-end gap-7 sm:gap-10">
        {POST_DISPLAY_RATIO_OPTIONS.map((option) => {
          const selected = displayAspectRatio === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setDisplayAspectRatio(option.value)}
              className={cn(
                "group flex min-h-[72px] min-w-[56px] flex-col items-center justify-end gap-2 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4",
                selected
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className="relative flex h-8 items-center justify-center"
                aria-hidden="true"
              >
                <span
                  className={cn(
                    "block border-[1.5px] transition-[border-color,box-shadow]",
                    selected
                      ? "border-foreground shadow-[0_0_0_2px_hsl(var(--card)),0_0_0_3px_hsl(var(--foreground))]"
                      : "border-muted-foreground/65 group-hover:border-foreground",
                  )}
                  style={{
                    aspectRatio: option.ratio,
                    height: option.ratio === 1 ? 28 : 32,
                  }}
                />
                {selected && (
                  <span className="absolute -right-3 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="h-2.5 w-2.5" aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold">
                {option.label}{" "}
                <span className="font-normal text-muted-foreground">
                  {option.helper}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  const writingField = (
    <div>
      <label
        htmlFor="post-content"
        className="text-sm font-semibold text-foreground"
      >
        Share something...
      </label>
      <Textarea
        id="post-content"
        rows={4}
        maxLength={2000}
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setPiiAcknowledged(false);
        }}
        className="mt-2 min-h-28 resize-none rounded-[8px] border-border/80 bg-background/45 px-3.5 py-3 text-base leading-6 shadow-none focus-visible:bg-card md:text-sm"
      />
      {content.length > 0 && (
        <p className="mt-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
          {content.length}/2000
        </p>
      )}
    </div>
  );

  const accessControls = (
    <fieldset className="border-t border-border/70 pt-5">
      <legend className="text-sm font-semibold text-foreground">
        Who can see this?
      </legend>
      <div className="mt-2 flex flex-wrap gap-x-7 gap-y-2">
        {(
          [
            {
              value: "free",
              label: "Everyone",
              helper: "Appears in the public feed",
            },
            {
              value: "premium",
              label: "Premium",
              helper: "Added to your Premium tab",
            },
          ] as const
        ).map((option) => {
          const selected = postAccess === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (option.value === "premium" && !canPostPremiumContent) {
                  setShowProviderUpgradePrompt(true);
                  setShowIdentityPrompt(false);
                  return;
                }
                if (option.value === "premium" && !canGoPremium) {
                  setShowIdentityPrompt(true);
                  setShowProviderUpgradePrompt(false);
                  return;
                }
                setShowProviderUpgradePrompt(false);
                setShowIdentityPrompt(false);
                setPostAccess(option.value);
              }}
              className="flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span
                className={cn(
                  "flex h-[18px] w-[18px] items-center justify-center rounded-full border",
                  selected ? "border-foreground" : "border-muted-foreground/60",
                )}
                aria-hidden="true"
              >
                {selected && (
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
                )}
              </span>
              {option.value === "premium" && (
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {postAccess === "premium"
          ? "Added to your Premium tab"
          : "Appears in the public feed"}
      </p>
      {showProviderUpgradePrompt && (
        <ProviderUpgradePrompt
          intent="premium-post"
          className="mt-4 shadow-none"
        />
      )}
      {showIdentityPrompt && !canGoPremium && (
        <div className="mt-4">
          <VerificationRequestCard
            requestType="creator"
            isVerified={false}
            latestStatus={null}
            skipRefresh
            onSubmitted={() => {
              setIdentitySubmittedLocally(true);
              setPostAccess("premium");
            }}
          />
        </div>
      )}
    </fieldset>
  );

  const publishControls = (
    <>
      {strippedImageCount > 0 && (
        <div className="flex items-start gap-2 border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-trust"
            aria-hidden="true"
          />
          <p>
            {strippedImageCount} uploaded{" "}
            {strippedImageCount === 1 ? "image was" : "images were"} re-encoded
            to remove common metadata.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm leading-5 text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-3 z-10 -mx-1 border-t border-border/70 bg-card/95 px-1 pt-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pt-0">
        <Button
          type="submit"
          disabled={submitting || uploading}
          className="h-12 w-full rounded-[8px] bg-foreground text-background shadow-none hover:bg-foreground/90 hover:shadow-none"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Publishing...
            </span>
          ) : (
            "Publish"
          )}
        </Button>
      </div>
    </>
  );

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="overflow-hidden border-y border-border/80 bg-card md:rounded-[8px] md:border md:shadow-card"
      >
        {modeControls}

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          multiple={postMode === "carousel"}
          className="hidden"
          onChange={handleFiles}
        />

        {mediaItems.length === 0 ? (
          <div className="p-4 sm:p-6 md:p-8">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex min-h-[240px] w-full flex-col items-center justify-center border border-dashed border-border bg-muted/20 px-6 py-10 text-center transition-colors hover:border-muted-foreground/60 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[280px]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
                {uploading ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
              <span className="mt-4 text-base font-semibold text-foreground">
                {uploading ? "Preparing your media..." : "Open gallery"}
              </span>
              <span className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                {postMode === "carousel"
                  ? `Choose up to ${MAX_POST_MEDIA_ITEMS} photos or videos for one carousel.`
                  : "Choose one photo or video from this device."}
              </span>
            </button>

            <div className="mx-auto mt-7 grid max-w-3xl gap-7 md:grid-cols-[0.8fr_1.2fr] md:gap-10">
              {frameControls}
              <div className="flex flex-col gap-5">
                {writingField}
                {accessControls}
                {publishControls}
              </div>
            </div>
          </div>
        ) : (
          <div className="md:grid md:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
            <section className="bg-black p-3 text-white md:border-r md:border-border/30 md:p-5">
              <div className="flex items-center justify-between gap-3 px-1 pb-3 text-xs text-white/60">
                <span>
                  {mediaItems.length > 1
                    ? `${activeMediaIndex + 1} of ${mediaItems.length}`
                    : "Preview"}
                </span>
                <span>
                  {selectedRatioOption?.label} {selectedRatioOption?.helper}
                </span>
              </div>

              <div className="flex min-h-[360px] items-center justify-center sm:min-h-[440px] md:min-h-[560px]">
                <div
                  className="relative max-w-full overflow-hidden bg-white/[0.04]"
                  style={{
                    aspectRatio: selectedRatio,
                    width: `min(100%, calc(64svh * ${selectedRatio}))`,
                  }}
                >
                  {activeMedia?.type === "video" ? (
                    <PostVideoPlayer
                      key={activeMedia.url}
                      src={activeMedia.url}
                      naturalWidth={activeMedia.width}
                      naturalHeight={activeMedia.height}
                      crop={activeMedia.crop}
                    />
                  ) : activeMedia ? (
                    <Image
                      src={activeMedia.url}
                      alt={`Post media preview ${activeMediaIndex + 1}`}
                      fill
                      sizes="(min-width: 1024px) 52vw, 100vw"
                      className="object-cover"
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto px-1 pb-1 pt-1">
                {mediaItems.map((item, index) => (
                  <div key={item.url} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveMediaIndex(index)}
                      aria-label={`Preview media ${index + 1}`}
                      className={cn(
                        "relative h-16 w-16 overflow-hidden border bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                        activeMediaIndex === index
                          ? "border-white"
                          : "border-white/20 hover:border-white/55",
                      )}
                    >
                      {item.type === "video" ? (
                        <span className="flex h-full w-full items-center justify-center">
                          <Video className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : (
                        <Image
                          src={item.url}
                          alt=""
                          fill
                          sizes="4rem"
                          className="object-cover"
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove media ${index + 1}`}
                      onClick={() => removeMedia(item.url)}
                      className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center bg-black/75 text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}

                {canAddMedia && (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    aria-label="Add more media"
                    className="flex h-16 w-16 shrink-0 items-center justify-center border border-dashed border-white/30 text-white/75 transition-colors hover:border-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-45"
                  >
                    {uploading ? (
                      <Loader2
                        className="h-5 w-5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ImagePlus className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-6 p-4 sm:p-6 md:p-7">
              {frameControls}

              {writingField}
              {accessControls}
              {publishControls}
            </section>
          </div>
        )}
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
                <AlertTriangle
                  className="h-5 w-5 text-destructive"
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0">
                <h2 id="pii-warning-title" className="text-base font-semibold">
                  Review possible personal info
                </h2>
                <p
                  id="pii-warning-description"
                  className="mt-1 text-sm text-muted-foreground"
                >
                  This post may include identifying details. Remove anything you
                  do not want shared.
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
              <Button
                type="button"
                onClick={continueAfterWarning}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? "Publishing..." : "Publish anyway"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {cropQueue.length > 0 ? (
        <ImageCropDialog
          key={cropQueue[0].file.name + cropQueue[0].file.lastModified}
          file={cropQueue[0].file}
          title="Adjust photo"
          initialPresetId={displayAspectRatio}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
          onError={handleCropError}
        />
      ) : (
        videoQueue.length > 0 && (
          <VideoFrameDialog
            key={videoQueue[0].name + videoQueue[0].lastModified}
            file={videoQueue[0]}
            ratio={selectedRatio}
            onCancel={handleVideoFrameCancel}
            onConfirm={handleVideoFrameConfirm}
          />
        )
      )}
    </>
  );
}
