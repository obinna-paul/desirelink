"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MAX_POST_IMAGES, type PostView } from "@/lib/posts";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function PostComposer({ onCreated }: { onCreated: (post: PostView) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isSubscriberOnly, setIsSubscriberOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload/post-image", { method: "POST", body: formData });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.error ?? "Upload failed. Please try again.");
          continue;
        }
        setImages((prev) => [...prev, body.url]);
      } catch {
        setError("Upload failed. Please try again.");
      }
    }

    setUploading(false);
    event.target.value = "";
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((existing) => existing !== url));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!content.trim() && images.length === 0) {
      setError("Write something or add an image.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), mediaUrls: images, isSubscriberOnly }),
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
        placeholder="Share something with your subscribers..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url) => (
            <div
              key={url}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-border/60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => removeImage(url)}
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
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
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
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isSubscriberOnly} onCheckedChange={setIsSubscriberOnly} />
            Subscribers only
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
    </form>
  );
}
