"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import { AlertTriangle, Image as ImageIcon, Loader2, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MAX_POST_IMAGES } from "@/lib/post-shared";
import type { PostView } from "@/lib/posts";
import { detectTextPii, hasImageMetadataSignature, type PiiFinding } from "@/lib/pii";
import { useFocusTrap } from "@/lib/use-focus-trap";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

type SanitizedImage = {
  url: string;
  metadataDetected: boolean;
};

function imageHasUsableCanvasType(file: File) {
  return file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
}

async function stripImageMetadata(file: File): Promise<File> {
  if (!imageHasUsableCanvasType(file)) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image could not be read"));
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(image, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, file.type, 0.92);
    });
    if (!blob) return file;

    return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function PostComposer({
  creatorDisplayName,
  onCreated,
}: {
  creatorDisplayName: string;
  onCreated: (post: PostView) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<SanitizedImage[]>([]);
  const [isSubscriberOnly, setIsSubscriberOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFindings, setPendingFindings] = useState<PiiFinding[]>([]);
  const [showPiiWarning, setShowPiiWarning] = useState(false);
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);
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

  const imageUrls = useMemo(() => images.map((image) => image.url), [images]);
  const strippedImageCount = useMemo(
    () => images.filter((image) => image.metadataDetected).length,
    [images]
  );

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (images.length + files.length > MAX_POST_IMAGES) {
      setError(`Up to ${MAX_POST_IMAGES} images per post.`);
      event.target.value = "";
      return;
    }

    setError(null);
    setUploading(true);

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("Please choose image files only.");
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError("Each image must be under 5MB.");
        continue;
      }

      try {
        const metadataDetected = hasImageMetadataSignature(await file.arrayBuffer());
        // Future vision-based PII scanning can run here before upload.
        const sanitizedFile = await stripImageMetadata(file);
        if (sanitizedFile.size > MAX_FILE_SIZE) {
          setError("Each image must be under 5MB after metadata stripping.");
          continue;
        }
        const formData = new FormData();
        formData.append("file", sanitizedFile);

        const res = await fetch("/api/upload/post-image", { method: "POST", body: formData });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.error ?? "Upload failed. Please try again.");
          continue;
        }
        setImages((prev) => [...prev, { url: body.url, metadataDetected }]);
      } catch {
        setError("Upload failed. Please try again.");
      }
    }

    setUploading(false);
    event.target.value = "";
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((existing) => existing.url !== url));
  }

  async function publishPost() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), mediaUrls: imageUrls, isSubscriberOnly }),
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
    setImages([]);
    setIsSubscriberOnly(false);
    setPiiAcknowledged(false);
    setPendingFindings([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!content.trim() && imageUrls.length === 0) {
      setError("Write something or add an image.");
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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4"
    >
      <label htmlFor="post-content" className="sr-only">
        Post content
      </label>
      <Textarea
        id="post-content"
        rows={3}
        maxLength={2000}
        placeholder="Share something with your Fans..."
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setPiiAcknowledged(false);
        }}
      />

      {(strippedImageCount > 0 || images.length > 0) && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neon-cyan" aria-hidden="true" />
          <p>
            {strippedImageCount > 0
              ? `${strippedImageCount} uploaded ${strippedImageCount === 1 ? "image had" : "images had"} metadata markers and ${strippedImageCount === 1 ? "was" : "were"} re-encoded before upload.`
              : "Images are re-encoded before upload to remove common metadata."}
          </p>
        </div>
      )}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image) => (
            <div
              key={image.url}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-border/60 bg-secondary"
            >
              <NextImage src={image.url} alt="" fill sizes="5rem" className="object-cover" />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => removeImage(image.url)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || images.length >= MAX_POST_IMAGES}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            )}
            {uploading ? "Uploading..." : "Add image"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <Switch checked={isSubscriberOnly} onCheckedChange={setIsSubscriberOnly} />
            Fans only
          </label>
        </div>
        <Button type="submit" disabled={submitting || uploading}>
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
            className="w-full max-w-md rounded-xl border border-border/60 bg-card p-5 shadow-lg focus:outline-none"
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
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
                >
                  <span>{finding.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {finding.count} {finding.count === 1 ? "match" : "matches"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPiiWarning(false);
                  setPiiAcknowledged(false);
                }}
              >
                Edit post
              </Button>
              <Button type="button" onClick={continueAfterWarning} disabled={submitting}>
                {submitting ? "Publishing..." : "Publish anyway"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
