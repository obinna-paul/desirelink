"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import { AlertTriangle, CalendarDays, Image as ImageIcon, Loader2, ShieldCheck, Video, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageCropDialog } from "@/components/creator/image-crop-dialog";
import { EVENT_TYPE_OPTIONS } from "@/lib/events";
import { MAX_POST_MEDIA_ITEMS, type PostMediaItem } from "@/lib/post-shared";
import type { PostView } from "@/lib/posts";
import { detectTextPii, hasImageMetadataSignature, type PiiFinding } from "@/lib/pii";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024;

type ComposerMode = "standard" | "event";

type UploadedMedia = PostMediaItem & {
  metadataDetected: boolean;
};

type PendingCrop = { file: File; metadataDetected: boolean };

type EventFormState = {
  title: string;
  eventType: (typeof EVENT_TYPE_OPTIONS)[number];
  startTime: string;
  endTime: string;
  venueName: string;
  address: string;
  city: string;
  maxAttendees: string;
  priceNaira: string;
  isPrivate: boolean;
};

const emptyEventForm: EventFormState = {
  title: "",
  eventType: EVENT_TYPE_OPTIONS[0],
  startTime: "",
  endTime: "",
  venueName: "",
  address: "",
  city: "",
  maxAttendees: "",
  priceNaira: "0",
  isPrivate: false,
};

export function PostComposer({
  creatorDisplayName,
  onCreated,
}: {
  creatorDisplayName: string;
  onCreated: (post: PostView) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<ComposerMode>("standard");
  const [mediaItems, setMediaItems] = useState<UploadedMedia[]>([]);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [isSubscriberOnly, setIsSubscriberOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFindings, setPendingFindings] = useState<PiiFinding[]>([]);
  const [showPiiWarning, setShowPiiWarning] = useState(false);
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);
  const [cropQueue, setCropQueue] = useState<PendingCrop[]>([]);
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

  const mediaPayload = useMemo(
    () =>
      mediaItems.map((item) => ({
        url: item.url,
        type: item.type,
        width: item.width,
        height: item.height,
        durationSeconds: item.durationSeconds,
      })),
    [mediaItems]
  );
  const strippedImageCount = useMemo(
    () => mediaItems.filter((image) => image.metadataDetected).length,
    [mediaItems]
  );

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
      setMediaItems((prev) => [...prev, { ...body.media, metadataDetected }]);
    } catch {
      setError("Upload failed. Please try again.");
    }
  }

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (mediaItems.length + cropQueue.length + files.length > MAX_POST_MEDIA_ITEMS) {
      setError(`Up to ${MAX_POST_MEDIA_ITEMS} media items per post.`);
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
        videosToUpload.push(file);
        continue;
      }

      // Future vision-based PII scanning can run here before upload.
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

    // Every image goes through the crop/adjust screen - defaulting to "Original" so a quick tap moves on unchanged.
    if (imagesToReview.length > 0) {
      setCropQueue((prev) => [...prev, ...imagesToReview]);
    }

    event.target.value = "";
  }

  async function handleCropConfirm({ file }: { file: File }) {
    const metadataDetected = cropQueue[0]?.metadataDetected ?? false;
    setCropQueue((prev) => prev.slice(1));
    setUploading(true);
    // The crop dialog's canvas re-draw already strips metadata, but that "images had metadata markers" note stays informative either way.
    // The server re-reads width/height from the uploaded (already-cropped) file, so the dialog's own values aren't needed here.
    await uploadFile(file, metadataDetected);
    setUploading(false);
  }

  function handleCropCancel() {
    setCropQueue((prev) => prev.slice(1));
  }

  function removeImage(url: string) {
    setMediaItems((prev) => prev.filter((existing) => existing.url !== url));
  }

  async function publishPost() {
    setSubmitting(true);
    setError(null);

    const eventPayload =
      mode === "event"
        ? {
            title: eventForm.title,
            eventType: eventForm.eventType,
            startTime: eventForm.startTime,
            endTime: eventForm.endTime,
            venueName: eventForm.venueName,
            address: eventForm.address,
            city: eventForm.city,
            maxAttendees: eventForm.maxAttendees ? Number(eventForm.maxAttendees) : null,
            priceCents: Math.round(Number(eventForm.priceNaira || 0) * 100),
            isPrivate: eventForm.isPrivate,
          }
        : undefined;

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content.trim(),
        mediaItems: mediaPayload,
        isSubscriberOnly,
        postType: mode,
        event: eventPayload,
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
    setMode("standard");
    setEventForm(emptyEventForm);
    setPiiAcknowledged(false);
    setPendingFindings([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!content.trim() && mediaPayload.length === 0 && mode !== "event") {
      setError("Write something or add media.");
      return;
    }
    if (mode === "event" && (!eventForm.title.trim() || !eventForm.startTime || !eventForm.endTime || !eventForm.venueName.trim())) {
      setError("Add the event title, time, and venue before publishing.");
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
      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm md:rounded-xl md:p-4 md:shadow-none"
    >
      <div className="grid grid-cols-2 gap-2 rounded-full bg-secondary/60 p-1">
        <button
          type="button"
          aria-pressed={mode === "standard"}
          onClick={() => setMode("standard")}
          className={cn(
            "min-h-10 rounded-full text-sm font-semibold transition-colors",
            mode === "standard" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Post
        </button>
        <button
          type="button"
          aria-pressed={mode === "event"}
          onClick={() => setMode("event")}
          className={cn(
            "min-h-10 rounded-full text-sm font-semibold transition-colors",
            mode === "event" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Event
        </button>
      </div>

      <label htmlFor="post-content" className="sr-only">
        Post content
      </label>
      <Textarea
        id="post-content"
        rows={3}
        maxLength={2000}
        placeholder={mode === "event" ? "Tell people why they should come..." : "Share something with your Fans..."}
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setPiiAcknowledged(false);
        }}
        className="min-h-28 resize-none rounded-2xl text-base md:rounded-md md:text-sm"
      />

      {mode === "event" && (
        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-background/50 p-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="feed-event-title" className="text-xs font-medium text-muted-foreground">
              Event title
            </label>
            <Input
              id="feed-event-title"
              value={eventForm.title}
              onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Name the event"
              className="mt-1 h-11"
            />
          </div>
          <div>
            <label htmlFor="feed-event-type" className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <Select
              id="feed-event-type"
              value={eventForm.eventType}
              onChange={(event) =>
                setEventForm((current) => ({
                  ...current,
                  eventType: event.target.value as (typeof EVENT_TYPE_OPTIONS)[number],
                }))
              }
              className="mt-1 h-11"
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="feed-event-venue" className="text-xs font-medium text-muted-foreground">
              Venue
            </label>
            <Input
              id="feed-event-venue"
              value={eventForm.venueName}
              onChange={(event) => setEventForm((current) => ({ ...current, venueName: event.target.value }))}
              placeholder="Venue or online"
              className="mt-1 h-11"
            />
          </div>
          <div>
            <label htmlFor="feed-event-start" className="text-xs font-medium text-muted-foreground">
              Starts
            </label>
            <Input
              id="feed-event-start"
              type="datetime-local"
              value={eventForm.startTime}
              onChange={(event) => setEventForm((current) => ({ ...current, startTime: event.target.value }))}
              className="mt-1 h-11"
            />
          </div>
          <div>
            <label htmlFor="feed-event-end" className="text-xs font-medium text-muted-foreground">
              Ends
            </label>
            <Input
              id="feed-event-end"
              type="datetime-local"
              value={eventForm.endTime}
              onChange={(event) => setEventForm((current) => ({ ...current, endTime: event.target.value }))}
              className="mt-1 h-11"
            />
          </div>
          <div>
            <label htmlFor="feed-event-city" className="text-xs font-medium text-muted-foreground">
              City
            </label>
            <Input
              id="feed-event-city"
              value={eventForm.city}
              onChange={(event) => setEventForm((current) => ({ ...current, city: event.target.value }))}
              placeholder="Uses profile city if blank"
              className="mt-1 h-11"
            />
          </div>
          <div>
            <label htmlFor="feed-event-capacity" className="text-xs font-medium text-muted-foreground">
              Capacity
            </label>
            <Input
              id="feed-event-capacity"
              type="number"
              min={1}
              value={eventForm.maxAttendees}
              onChange={(event) => setEventForm((current) => ({ ...current, maxAttendees: event.target.value }))}
              placeholder="Unlimited"
              className="mt-1 h-11"
            />
          </div>
          <div>
            <label htmlFor="feed-event-price" className="text-xs font-medium text-muted-foreground">
              Price NGN
            </label>
            <Input
              id="feed-event-price"
              type="number"
              min={0}
              step="0.01"
              value={eventForm.priceNaira}
              onChange={(event) => setEventForm((current) => ({ ...current, priceNaira: event.target.value }))}
              className="mt-1 h-11"
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-3 text-sm md:col-span-2">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-neon-pink" aria-hidden="true" />
              Private event
            </span>
            <Switch
              checked={eventForm.isPrivate}
              onCheckedChange={(checked) => setEventForm((current) => ({ ...current, isPrivate: checked }))}
            />
          </label>
        </section>
      )}

      {(strippedImageCount > 0 || mediaItems.length > 0) && (
        <div className="flex items-start gap-2 rounded-2xl border border-border/60 bg-secondary/40 p-3 text-xs text-muted-foreground md:rounded-lg">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neon-cyan" aria-hidden="true" />
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
              className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/60 bg-secondary sm:h-20 sm:w-20 sm:rounded-lg"
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || mediaItems.length >= MAX_POST_MEDIA_ITEMS}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:rounded-md"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            )}
            {uploading ? "Uploading..." : "Add media"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <Switch checked={isSubscriberOnly} onCheckedChange={setIsSubscriberOnly} />
            Fans only
          </label>
        </div>
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
            className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-5 shadow-lg focus:outline-none md:rounded-xl"
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
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm md:rounded-lg"
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

    {cropQueue.length > 0 && (
      <ImageCropDialog
        key={cropQueue[0].file.name + cropQueue[0].file.lastModified}
        file={cropQueue[0].file}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
    )}
    </>
  );
}
