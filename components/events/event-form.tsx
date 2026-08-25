"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Loader2, X } from "lucide-react";
import type { Event } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EVENT_TYPE_OPTIONS } from "@/lib/events";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

type FormState = {
  title: string;
  description: string;
  eventType: string;
  startTime: string;
  endTime: string;
  venueName: string;
  address: string;
  city: string;
  lat: string;
  lng: string;
  maxAttendees: string;
  priceDollars: string;
  isPrivate: boolean;
  coverImageUrl: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  eventType: EVENT_TYPE_OPTIONS[0],
  startTime: "",
  endTime: "",
  venueName: "",
  address: "",
  city: "",
  lat: "",
  lng: "",
  maxAttendees: "",
  priceDollars: "",
  isPrivate: false,
  coverImageUrl: "",
};

function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function eventToForm(event: Event): FormState {
  return {
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    startTime: toDatetimeLocal(new Date(event.startTime)),
    endTime: toDatetimeLocal(new Date(event.endTime)),
    venueName: event.venueName,
    address: event.address,
    city: event.city,
    lat: event.lat ? String(event.lat) : "",
    lng: event.lng ? String(event.lng) : "",
    maxAttendees: event.maxAttendees ? String(event.maxAttendees) : "",
    priceDollars: event.priceCents ? String(event.priceCents / 100) : "",
    isPrivate: event.isPrivate,
    coverImageUrl: event.coverImageUrl,
  };
}

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

export function EventForm({ event, eventId }: { event?: Event; eventId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(event ? eventToForm(event) : EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

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
      const res = await fetch("/api/upload/event-cover", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Upload failed. Please try again.");
        return;
      }
      update("coverImageUrl", body.url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.venueName.trim() || !form.startTime || !form.endTime) {
      setError("Fill in the required fields.");
      return;
    }

    const startTime = new Date(form.startTime);
    const endTime = new Date(form.endTime);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      setError("Enter valid start and end times.");
      return;
    }
    if (endTime <= startTime) {
      setError("End time must be after start time.");
      return;
    }

    setSubmitting(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      eventType: form.eventType,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      venueName: form.venueName.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      lat: form.lat ? Number(form.lat) : 0,
      lng: form.lng ? Number(form.lng) : 0,
      maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null,
      priceCents: form.priceDollars ? Math.round(Number(form.priceDollars) * 100) : 0,
      isPrivate: form.isPrivate,
      coverImageUrl: form.coverImageUrl,
    };

    const res = await fetch(eventId ? `/api/events/${eventId}` : "/api/events", {
      method: eventId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/events/manage");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Cover image
        </h2>
        <div className="flex items-center gap-4">
          {form.coverImageUrl ? (
            <div className="relative h-24 w-40 overflow-hidden rounded-lg border border-border/60 bg-secondary">
              <Image
                src={form.coverImageUrl}
                alt=""
                fill
                sizes="10rem"
                className="object-cover"
              />
              <button
                type="button"
                aria-label="Remove cover image"
                onClick={() => update("coverImageUrl", "")}
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
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
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
        <FieldWrapper label="Title" htmlFor="title" required>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            maxLength={120}
          />
        </FieldWrapper>
        <FieldWrapper label="Description" htmlFor="description">
          <Textarea
            id="description"
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            maxLength={3000}
          />
        </FieldWrapper>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Event type" htmlFor="eventType" required>
            <Select
              id="eventType"
              value={form.eventType}
              onChange={(e) => update("eventType", e.target.value)}
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Private event" htmlFor="isPrivate">
            <label htmlFor="isPrivate" className="flex min-h-11 cursor-pointer items-center gap-2">
              <Switch
                id="isPrivate"
                checked={form.isPrivate}
                onCheckedChange={(checked) => update("isPrivate", checked)}
              />
              <span className="text-sm text-muted-foreground">
                {form.isPrivate ? "Invite-only" : "Visible to everyone"}
              </span>
            </label>
          </FieldWrapper>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Date &amp; time
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Starts" htmlFor="startTime" required>
            <Input
              id="startTime"
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => update("startTime", e.target.value)}
            />
          </FieldWrapper>
          <FieldWrapper label="Ends" htmlFor="endTime" required>
            <Input
              id="endTime"
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => update("endTime", e.target.value)}
            />
          </FieldWrapper>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Location
        </h2>
        <FieldWrapper label="Venue name" htmlFor="venueName" required>
          <Input
            id="venueName"
            value={form.venueName}
            onChange={(e) => update("venueName", e.target.value)}
            maxLength={150}
          />
        </FieldWrapper>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Address" htmlFor="address">
            <Input
              id="address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              maxLength={300}
            />
          </FieldWrapper>
          <FieldWrapper label="City" htmlFor="city">
            <Input
              id="city"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              maxLength={100}
            />
          </FieldWrapper>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Latitude (optional)" htmlFor="lat">
            <Input
              id="lat"
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => update("lat", e.target.value)}
            />
          </FieldWrapper>
          <FieldWrapper label="Longitude (optional)" htmlFor="lng">
            <Input
              id="lng"
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => update("lng", e.target.value)}
            />
          </FieldWrapper>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Capacity &amp; price
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Max attendees (optional)" htmlFor="maxAttendees">
            <Input
              id="maxAttendees"
              type="number"
              min={1}
              placeholder="Unlimited"
              value={form.maxAttendees}
              onChange={(e) => update("maxAttendees", e.target.value)}
            />
          </FieldWrapper>
          <FieldWrapper label="Price, USD (optional)" htmlFor="price">
            <Input
              id="price"
              type="number"
              min={0}
              step="0.01"
              placeholder="Free"
              value={form.priceDollars}
              onChange={(e) => update("priceDollars", e.target.value)}
            />
          </FieldWrapper>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting || uploading}>
          {submitting ? "Saving..." : eventId ? "Save changes" : "Create event"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/events/manage")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
