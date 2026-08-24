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
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Cover image
        </h2>
        <div className="flex items-center gap-4">
          {coverImageUrl ? (
            <div className="relative h-24 w-40 overflow-hidden rounded-lg border border-border/60 bg-secondary">
              <Image src={coverImageUrl} alt="" fill sizes="10rem" className="object-cover" />
              <button
                type="button"
                aria-label="Remove cover image"
                onClick={() => setCoverImageUrl("")}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
              No image
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
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

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </h2>
        <FieldWrapper label="Name" htmlFor="name" required>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </FieldWrapper>
        <FieldWrapper label="Description" htmlFor="description">
          <Textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </FieldWrapper>
        <FieldWrapper label="Private room" htmlFor="isPrivate">
          <div className="flex h-10 items-center gap-2">
            <Switch id="isPrivate" checked={isPrivate} onCheckedChange={setIsPrivate} />
            <span className="text-sm text-muted-foreground">
              {isPrivate ? "Join requests require your approval" : "Anyone can join instantly"}
            </span>
          </div>
        </FieldWrapper>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting || uploading}>
          {submitting ? "Creating..." : "Create room"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/communities")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
