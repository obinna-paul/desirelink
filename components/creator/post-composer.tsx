"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
import { ProgressRing } from "@/components/ui/progress-ring";
import { UploadProgress } from "@/components/ui/upload-progress";
import { ImageCropDialog } from "@/components/creator/image-crop-dialog";
import { HashtagTextarea } from "@/components/creator/hashtag-textarea";
import { TierPicker } from "@/components/creator/tier-picker";
import { VideoFrameDialog } from "@/components/creator/video-frame-dialog";
import { ProviderUpgradePrompt } from "@/components/settings/provider-upgrade-prompt";
import { VerificationRequestCard } from "@/components/verification/verification-request-card";
import { PostVideoPlayer } from "@/components/posts/post-video-player";
import {
  MAX_POST_MEDIA_ITEMS,
  IMAGE_CROP_PRESETS,
  POST_DISPLAY_RATIO_OPTIONS,
  isPostDisplayAspectRatio,
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
import { convertHeicFileToJpeg, isHeicFile } from "@/lib/heic-convert";
import {
  readFileAsArrayBuffer,
  inferMediaTypeFromFileName,
  sniffMediaType,
  withNormalizedMediaType,
} from "@/lib/media-sniff";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  uploadMediaDirectToCloudinary,
  uploadVideoDirect,
  type VideoUploadPhase,
} from "@/lib/client-uploads";
import { cn } from "@/lib/utils";
import {
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_UPLOAD_BYTES,
  VIDEO_UPLOAD_ACCEPT,
} from "@/lib/video-upload-constraints";

const MAX_IMAGE_FILE_SIZE = 30 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.max(0.1, bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Reads a video's duration without ever attaching it to the DOM — resolves 0 (never rejects) if the browser can't read metadata within the timeout, so an unreadable file falls through to the frame dialog's own error handling instead of blocking selection here. */
function readVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish(0), 8000);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      finish(Number.isFinite(video.duration) ? video.duration : 0);
    };
    video.onerror = () => {
      window.clearTimeout(timeout);
      finish(0);
    };
    video.src = url;
  });
}

type UploadedMedia = PostMediaItem & {
  metadataDetected: boolean;
};

type PendingMediaReview = {
  file: File;
  kind: "image" | "video";
  metadataDetected: boolean;
  imagePurpose?: "post-image" | "post-image-normalize";
};
type PreparedMediaReview = {
  pending: PendingMediaReview;
  adjustedFile?: File;
  crop?: VideoCrop;
};
type FailedMediaUpload = PreparedMediaReview & {
  remaining: PreparedMediaReview[];
};
type PostMode = "single" | "carousel";
type PostAccess = "free" | "premium";

export type ComposerTier = {
  id: string;
  name: string;
  priceCents: number;
  compareAtPriceCents: number | null;
};

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
  tiers = [],
  onCreated,
}: {
  creatorDisplayName: string;
  canPostPremiumContent?: boolean;
  hasIdentityOnFile?: boolean;
  /** This creator's subscription tiers, cheapest first - without at least one, marking a
   * post Premium locks it for everyone with no tier to ever unlock it. When there's more
   * than one, the creator must pick which tier unlocks this specific post. */
  tiers?: ComposerTier[];
  onCreated: (post: PostView) => void;
}) {
  const hasPricingTier = tiers.length > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const piiDialogRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [postMode, setPostMode] = useState<PostMode>("single");
  const [displayAspectRatio, setDisplayAspectRatioState] =
    useState<PostDisplayAspectRatio>(DEFAULT_DISPLAY_RATIO);
  const [mediaItems, setMediaItems] = useState<UploadedMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [postAccess, setPostAccess] = useState<PostAccess>("free");
  const [selectedTierId, setSelectedTierId] = useState<string | null>(
    tiers.length === 1 ? tiers[0].id : null,
  );
  const [uploading, setUploading] = useState(false);
  /** Distinguishes "sending the file" from "Bunny Stream is transcoding it" so a video
   * upload doesn't just sit on a generic spinner during the (usually few-second) wait for
   * a playable rendition - text-only, doesn't affect the `uploading` disabled-state logic. */
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [uploadingPhase, setUploadingPhase] = useState<VideoUploadPhase | "image" | null>(null);
  /** 0-100 when the current upload/processing step reports real progress (Cloudinary's
   * XHR upload events, Bunny's TUS upload, or Bunny's own transcode encodeProgress); null
   * while nothing's known yet (e.g. before the first progress event, or the local-disk
   * dev fallback, which has no progress signal at all) - the UI falls back to a spinner
   * only in that null case. */
  const [uploadingProgress, setUploadingProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProviderUpgradePrompt, setShowProviderUpgradePrompt] =
    useState(false);
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [showPricingPrompt, setShowPricingPrompt] = useState(false);
  const [identitySubmittedLocally, setIdentitySubmittedLocally] =
    useState(false);
  const [pendingFindings, setPendingFindings] = useState<PiiFinding[]>([]);
  const [showPiiWarning, setShowPiiWarning] = useState(false);
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<PendingMediaReview[]>([]);
  const [preparedReviews, setPreparedReviews] = useState<PreparedMediaReview[]>([]);
  const [failedUpload, setFailedUpload] = useState<FailedMediaUpload | null>(null);

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
  const activeReview = reviewQueue[0];
  const reviewPosition = reviewQueue.length > 0
    ? {
        index: preparedReviews.length + 1,
        total: preparedReviews.length + reviewQueue.length,
      }
    : undefined;
  const canChooseReviewFrame = mediaItems.length === 0 && reviewPosition?.index === 1;
  const reviewImagePresets = canChooseReviewFrame
    ? IMAGE_CROP_PRESETS
    : IMAGE_CROP_PRESETS.filter((preset) => preset.id === displayAspectRatio);

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
    pending: PendingMediaReview,
    adjustedFile?: File,
    crop?: VideoCrop,
  ): Promise<boolean> {
    const file = adjustedFile ?? pending.file;
    const isVideo = pending.kind === "video";
    setUploading(true);
    setUploadingFileName(file.name);
    setUploadingPhase(isVideo ? "preparing" : "image");
    setUploadingLabel(isVideo ? "Preparing video..." : "Uploading photo...");
    setUploadingProgress(null);
    setError(null);

    try {
      const media = isVideo
        ? await uploadVideoDirect(
            file,
            "/api/upload/post-media",
            (fraction) =>
              setUploadingProgress((current) =>
                Math.max(current ?? 0, Math.round(fraction * 100)),
              ),
            (phase) => {
              setUploadingPhase(phase);
              if (phase === "processing") {
                setUploadingLabel("Processing video...");
              } else if (phase === "reconnecting") {
                setUploadingLabel("Upload paused. Reconnecting...");
              } else if (phase === "retrying") {
                setUploadingLabel("Video service interrupted. Resuming...");
              } else if (phase === "preparing") {
                setUploadingLabel("Preparing video...");
              } else {
                setUploadingLabel("Uploading video...");
              }
            },
          )
        : await uploadMediaDirectToCloudinary(
            file,
            adjustedFile ? "post-image" : pending.imagePurpose ?? "post-image",
            "/api/upload/post-media",
            (fraction) =>
              setUploadingProgress((current) =>
                Math.max(current ?? 0, Math.round(fraction * 100)),
              ),
          );

      setMediaItems((prev) => [
        ...prev,
        {
          ...media,
          type: isVideo ? "video" : "image",
          displayAspectRatio,
          metadataDetected: pending.metadataDetected,
          crop,
        },
      ]);
      setUploadingProgress(100);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      return false;
    } finally {
      setUploading(false);
      setUploadingLabel(null);
      setUploadingFileName(null);
      setUploadingPhase(null);
      setUploadingProgress(null);
    }
  }

  async function uploadReviewedMedia(items: PreparedMediaReview[]) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const succeeded = await uploadFile(item.pending, item.adjustedFile, item.crop);
      if (!succeeded) {
        setFailedUpload({ ...item, remaining: items.slice(index + 1) });
        return;
      }
    }
  }

  function completeMediaReview(item: PreparedMediaReview) {
    const remainingReviews = reviewQueue.slice(1);
    const completedReviews = [...preparedReviews, item];

    if (remainingReviews.length > 0) {
      setPreparedReviews(completedReviews);
      setReviewQueue(remainingReviews);
      return;
    }

    setPreparedReviews([]);
    setReviewQueue([]);
    void uploadReviewedMedia(completedReviews);
  }

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (
      postMode === "single" &&
      (files.length > 1 ||
        mediaItems.length >= 1 ||
        reviewQueue.length >= 1)
    ) {
      setError(
        "Single posts can use one photo or video. Switch to carousel for multiple media.",
      );
      event.target.value = "";
      return;
    }

    if (
      mediaItems.length + reviewQueue.length + files.length >
      MAX_POST_MEDIA_ITEMS
    ) {
      setError(`Up to ${MAX_POST_MEDIA_ITEMS} media items per carousel.`);
      event.target.value = "";
      return;
    }

    setError(null);

    const mediaToReview: PendingMediaReview[] = [];
    let lastError: string | null = null;

    for (const file of files) {
      try {
        let workingFile = file;

        let imagePurpose: PendingMediaReview["imagePurpose"] = "post-image";
        if (isHeicFile(workingFile)) {
          try {
            workingFile = await convertHeicFileToJpeg(workingFile);
          } catch {
            imagePurpose = "post-image-normalize";
          }
        }

        let isImage = workingFile.type.startsWith("image/");
        let isVideo = workingFile.type.startsWith("video/");

        // Some Android pickers, cloud-download managers, and OS/browser combos hand us a
        // File with an empty or generic `type` - fall back to sniffing the real header bytes
        // rather than rejecting a perfectly valid photo or video outright.
        if (!isImage && !isVideo) {
          const detectedType =
            (await sniffMediaType(workingFile).catch(() => null)) ??
            inferMediaTypeFromFileName(workingFile.name);
          if (detectedType) {
            workingFile = withNormalizedMediaType(workingFile, detectedType);
            isImage = detectedType.startsWith("image/");
            isVideo = detectedType.startsWith("video/");
          }
        }

        if (!isImage && !isVideo) {
          lastError = "Choose image or video files only.";
          continue;
        }
        if (isImage && workingFile.size > MAX_IMAGE_FILE_SIZE) {
          lastError = `Each image must be under ${MAX_IMAGE_FILE_SIZE / (1024 * 1024)}MB.`;
          continue;
        }
        if (isVideo && workingFile.size > MAX_VIDEO_UPLOAD_BYTES) {
          lastError = "Each video can be up to 2GB.";
          continue;
        }

        if (isVideo) {
          const durationSeconds = await readVideoDurationSeconds(workingFile);
          if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
            lastError = `Videos must be ${Math.round(MAX_VIDEO_DURATION_SECONDS / 60)} minutes or shorter.`;
            continue;
          }
          mediaToReview.push({
            file: workingFile,
            kind: "video",
            metadataDetected: false,
          });
          continue;
        }

        // Metadata sniffing is a nice-to-have notice, not a gate - if reading the file for it
        // fails (e.g. a cloud-sync placeholder still resolving to disk), the photo still goes
        // through; a genuinely unreadable file will surface a clear error at the crop step instead.
        let metadataDetected = false;
        try {
          metadataDetected = hasImageMetadataSignature(
            await readFileAsArrayBuffer(workingFile.slice(0, 512 * 1024)),
          );
        } catch {
          metadataDetected = false;
        }
        mediaToReview.push({
          file: workingFile,
          kind: "image",
          metadataDetected,
          imagePurpose,
        });
      } catch {
        lastError = "One file couldn't be processed. Try a different photo or video.";
      }
    }

    if (lastError) setError(lastError);

    // Every photo and video goes through the frame/adjust screen, cropped to the post's
    // chosen dimension - this is what keeps the feed WYSIWYG with what was previewed here.
    if (mediaToReview.length > 0) {
      setReviewQueue((prev) => [...prev, ...mediaToReview]);
    }

    event.target.value = "";
  }

  function handleCropConfirm({ file }: { file: File }) {
    const pending = reviewQueue[0];
    if (!pending || pending.kind !== "image") return;
    completeMediaReview({ pending, adjustedFile: file });
  }

  function handleCropCancel() {
    setPreparedReviews([]);
    setReviewQueue([]);
  }

  function handleCropError() {
    const pending = reviewQueue[0];
    if (!pending || pending.kind !== "image") return;

    // The browser's own canvas decode couldn't pan/zoom-crop this photo (an uncommon
    // color profile, an oversized image past this device's decode limit, or similar) -
    // that's a client-side preview limitation, not a reason to reject the upload.
    // Cloudinary decodes a much broader range of formats server-side than a browser can,
    // so upload the original file uncropped rather than forcing a different one.
    completeMediaReview({ pending });
  }

  function handleVideoFrameConfirm({
    crop,
  }: {
    crop: VideoCrop;
    width: number;
    height: number;
    durationSeconds: number;
  }) {
    const pending = reviewQueue[0];
    if (!pending || pending.kind !== "video") return;
    completeMediaReview({ pending, crop });
  }

  function handleVideoFrameCancel() {
    setPreparedReviews([]);
    setReviewQueue([]);
  }

  function handleVideoFrameError() {
    const pending = reviewQueue[0];
    if (!pending || pending.kind !== "video") return;

    // The browser's own <video> element couldn't decode this file well enough to preview
    // it for cropping (an unsupported codec/container on this device, or a slow load) -
    // that's a client-side preview limitation, not a reason to reject an otherwise valid
    // upload. Upload the original file as-is with no custom crop rather than forcing the
    // person to find a different file or re-export it.
    completeMediaReview({ pending });
  }

  async function retryFailedUpload() {
    if (!failedUpload) return;
    const remaining = failedUpload.remaining;
    const succeeded = await uploadFile(
      failedUpload.pending,
      failedUpload.adjustedFile,
      failedUpload.crop,
    );
    if (!succeeded) return;
    setFailedUpload(null);
    if (remaining.length > 0) void uploadReviewedMedia(remaining);
  }

  function removeFailedUpload() {
    const remaining = failedUpload?.remaining ?? [];
    setFailedUpload(null);
    setError(null);
    if (remaining.length > 0) void uploadReviewedMedia(remaining);
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
        tierId: isSubscriberOnly ? selectedTierId : undefined,
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
    setSelectedTierId(tiers.length === 1 ? tiers[0].id : null);
    setPiiAcknowledged(false);
    setPendingFindings([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (reviewQueue.length > 0 || uploading) {
      setError("Finish adding the selected media before publishing.");
      return;
    }

    if (!content.trim() && mediaPayload.length === 0) {
      setError("Share something or add media before publishing.");
      return;
    }

    if (isSubscriberOnly && !selectedTierId) {
      setError("Choose which tier unlocks this post.");
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
          disabled={uploading || reviewQueue.length > 0}
          onClick={() => setMode(option.value)}
          className={cn(
            "relative min-h-12 flex-1 px-4 text-sm font-semibold transition-colors after:absolute after:inset-x-5 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-foreground after:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none motion-reduce:after:transition-none",
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
        Choose once for the whole post. You can also change it while reviewing your media.
      </p>
      <div className="mt-3 grid grid-cols-4 items-end gap-1 sm:flex sm:gap-8">
        {POST_DISPLAY_RATIO_OPTIONS.map((option) => {
          const selected = displayAspectRatio === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={uploading || reviewQueue.length > 0}
              onClick={() => setDisplayAspectRatio(option.value)}
              className={cn(
                "group flex min-h-[72px] min-w-0 flex-col items-center justify-end gap-2 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-[64px]",
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
                    height: option.ratio > 1 ? 24 : option.ratio === 1 ? 28 : 32,
                  }}
                />
                {selected && (
                  <span className="absolute -right-3 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="h-2.5 w-2.5" aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold leading-4 sm:text-xs">
                <span className="block">{option.label}</span>
                <span className="block font-normal text-muted-foreground">{option.helper}</span>
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
      <HashtagTextarea
        id="post-content"
        maxLength={2000}
        value={content}
        onValueChange={setContent}
        onContentEdited={() => setPiiAcknowledged(false)}
      />
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
                  setShowPricingPrompt(false);
                  return;
                }
                if (option.value === "premium" && !hasPricingTier) {
                  setShowPricingPrompt(true);
                  setShowProviderUpgradePrompt(false);
                  setShowIdentityPrompt(false);
                  return;
                }
                setShowProviderUpgradePrompt(false);
                setShowIdentityPrompt(false);
                setShowPricingPrompt(false);
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
            heading="Please submit identification to post premium content."
            skipRefresh
            onSubmitted={() => {
              setIdentitySubmittedLocally(true);
              setPostAccess("premium");
            }}
          />
        </div>
      )}
      {showPricingPrompt && !hasPricingTier && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-xl md:shadow-none">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="text-sm">
            <p>Oops! Looks like you haven&rsquo;t set up a subscription tier yet.</p>
            <Link
              href="/creator-dashboard?tab=pricing"
              className="mt-3 inline-flex min-h-11 items-center rounded-full border-2 border-trust px-4 text-sm font-semibold text-trust transition-colors hover:bg-trust/10"
            >
              Set up your pricing first
            </Link>
          </div>
        </div>
      )}
      {postAccess === "premium" && hasPricingTier && (
        <div className="mt-4">
          <TierPicker
            tiers={tiers}
            value={selectedTierId}
            onChange={setSelectedTierId}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Subscribers to this tier or higher will see this post.
          </p>
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

      {error && !failedUpload && (
        <p role="alert" className="text-sm leading-5 text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-3 z-10 -mx-1 border-t border-border/70 bg-card/95 px-1 pt-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pt-0">
        <Button
          type="submit"
          disabled={
            submitting ||
            uploading ||
            reviewQueue.length > 0 ||
            (isSubscriberOnly && !selectedTierId)
          }
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

  const failedUploadPanel = failedUpload ? (
    <div className="w-full border border-destructive/25 bg-destructive/[0.04] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">This upload needs attention</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {failedUpload.pending.file.name} · {formatFileSize(failedUpload.pending.file.size)}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm leading-5 text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          onClick={() => void retryFailedUpload()}
          className="h-11 flex-1 rounded-[8px] bg-foreground text-background hover:bg-foreground/90"
        >
          Try upload again
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={removeFailedUpload}
          className="h-11 flex-1 rounded-[8px]"
        >
          Remove this file
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <form
        onSubmit={handleSubmit}
        aria-busy={uploading}
        className="overflow-hidden border-y border-border/80 bg-card md:rounded-[8px] md:border md:shadow-card"
      >
        {modeControls}

        <input
          ref={inputRef}
          type="file"
          accept={`image/*,${VIDEO_UPLOAD_ACCEPT}`}
          multiple={postMode === "carousel"}
          disabled={uploading}
          className="hidden"
          onChange={handleFiles}
        />

        {mediaItems.length === 0 ? (
          <div className="p-4 sm:p-6 md:p-8">
            {uploading ? (
              <div className="flex min-h-[240px] w-full flex-col items-center justify-center border border-dashed border-border bg-muted/20 px-6 py-10 sm:min-h-[280px]">
                <UploadProgress
                  progress={uploadingProgress}
                  label={uploadingLabel ?? "Preparing your media..."}
                  fileName={uploadingFileName ?? undefined}
                  phase={uploadingPhase}
                  hint={
                    uploadingLabel === "Processing video..."
                      ? "Getting it ready to play smoothly on every device."
                      : "Keep this screen open - it picks up where it left off if your connection dips."
                  }
                />
              </div>
            ) : failedUploadPanel ? (
              <div className="flex min-h-[240px] items-center justify-center sm:min-h-[280px]">
                {failedUploadPanel}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex min-h-[240px] w-full flex-col items-center justify-center border border-dashed border-border bg-muted/20 px-6 py-10 text-center transition-colors hover:border-muted-foreground/60 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[280px]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-4 text-base font-semibold text-foreground">Open gallery</span>
                <span className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                  {postMode === "carousel"
                    ? `Choose up to ${MAX_POST_MEDIA_ITEMS} photos or videos for one carousel.`
                    : "Choose one photo or video from this device."}
                </span>
              </button>
            )}

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
                      quality={92}
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
                          quality={90}
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
                      uploadingProgress === null ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      ) : (
                        <ProgressRing progress={uploadingProgress} size={32} strokeWidth={2} />
                      )
                    ) : (
                      <ImagePlus className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-6 p-4 sm:p-6 md:p-7">
              {uploading && (
                <div className="border-b border-border/70 pb-6">
                  <UploadProgress
                    progress={uploadingProgress}
                    label={uploadingLabel ?? "Preparing your media..."}
                    fileName={uploadingFileName ?? undefined}
                    phase={uploadingPhase}
                    hint={
                      uploadingLabel === "Processing video..."
                        ? "The upload is complete. Bunny is preparing smooth playback quality."
                        : "You can keep this screen open while the upload resumes through brief connection changes."
                    }
                  />
                </div>
              )}
              {!uploading && failedUploadPanel}

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

      {!uploading && !failedUpload && activeReview?.kind === "image" ? (
        <ImageCropDialog
          key={`${activeReview.file.name}-${activeReview.file.lastModified}-${activeReview.file.size}`}
          file={activeReview.file}
          title={reviewPosition && reviewPosition.total > 1 ? "Adjust carousel" : "Adjust photo"}
          initialPresetId={displayAspectRatio}
          selectedPresetId={displayAspectRatio}
          presets={reviewImagePresets}
          position={reviewPosition}
          onPresetChange={(presetId) => {
            if (isPostDisplayAspectRatio(presetId)) setDisplayAspectRatio(presetId);
          }}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
          onError={handleCropError}
        />
      ) : (
        !uploading &&
        !failedUpload &&
        activeReview?.kind === "video" && (
          <VideoFrameDialog
            key={`${activeReview.file.name}-${activeReview.file.lastModified}-${activeReview.file.size}`}
            file={activeReview.file}
            title={reviewPosition && reviewPosition.total > 1 ? "Adjust carousel" : "Adjust video"}
            ratio={selectedRatio}
            ratioOptions={
              canChooseReviewFrame
                ? POST_DISPLAY_RATIO_OPTIONS.map((option) => ({
                    id: option.value,
                    label: option.helper,
                  }))
                : undefined
            }
            selectedRatioId={displayAspectRatio}
            position={reviewPosition}
            onRatioChange={(ratioId) => {
              if (isPostDisplayAspectRatio(ratioId)) setDisplayAspectRatio(ratioId);
            }}
            onCancel={handleVideoFrameCancel}
            onConfirm={handleVideoFrameConfirm}
            onError={handleVideoFrameError}
          />
        )
      )}
    </>
  );
}
