"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function FieldWrapper({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

export function RoomForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be under 5MB.");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload/room-cover", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Upload failed. Please try again.");
        return;
      }
      setCoverImageUrl(body.url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 3) {
      setError("Room name must be at least 3 characters.");
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        isPrivate,
        coverImageUrl,
      }),
    });

    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push(`/rooms/${body.room.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:gap-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Cover image
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {coverImageUrl ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-secondary sm:h-24 sm:w-40 md:rounded-lg">
              <Image src={coverImageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 10rem" className="object-cover" />
              <button
                type="button"
                aria-label="Remove cover image"
                onClick={() => setCoverImageUrl("")}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-foreground transition-colors hover:bg-background sm:right-1 sm:top-1 sm:h-5 sm:w-5"
              >
                <X className="h-4 w-4 sm:h-3 sm:w-3" />
              </button>
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-border/60 text-xs text-muted-foreground sm:h-24 sm:w-40 md:rounded-lg">
              No image
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto md:rounded-md"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            )}
            {uploading ? "Uploading..." : "Upload cover"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverUpload}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Details
        </h2>
        <FieldWrapper label="Name" htmlFor="name" required>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </FieldWrapper>
        <FieldWrapper label="Description" htmlFor="description">
          <Textarea
            id="description"
            rows={4}
            className="resize-none rounded-2xl md:rounded-md"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </FieldWrapper>
        <FieldWrapper label="Private room" htmlFor="isPrivate">
          <label htmlFor="isPrivate" className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-background px-3 py-2 md:min-h-11 md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0">
            <Switch id="isPrivate" checked={isPrivate} onCheckedChange={setIsPrivate} />
            <span className="text-sm text-muted-foreground">
              {isPrivate ? "Join requests require your approval" : "Anyone can join instantly"}
            </span>
          </label>
        </FieldWrapper>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-20 z-10 grid grid-cols-1 gap-2 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur sm:static sm:flex sm:bg-transparent sm:p-0 sm:shadow-none">
        <Button type="submit" className="w-full sm:w-auto" disabled={submitting || uploading}>
          {submitting ? "Creating..." : "Create room"}
        </Button>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.push("/communities")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
