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
import { VerificationRequestCard } from "@/components/verification/verification-request-card";
import { EVENT_FORMAT_OPTIONS, EVENT_TYPE_OPTIONS, type EventFormatValue } from "@/lib/events";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

type FormState = {
  title: string;
  description: string;
  eventType: string;
  format: EventFormatValue;
  onlineUrl: string;
  startTime: string;
  endTime: string;
  venueName: string;
  address: string;
  city: string;
  lat: string;
  lng: string;
  maxAttendees: string;
  priceNaira: string;
  isPrivate: boolean;
  coverImageUrl: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  eventType: EVENT_TYPE_OPTIONS[0],
  format: "in_person",
  onlineUrl: "",
  startTime: "",
  endTime: "",
  venueName: "",
  address: "",
  city: "",
  lat: "",
  lng: "",
  maxAttendees: "",
  priceNaira: "",
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
    format: (event.format as EventFormatValue) ?? "in_person",
    onlineUrl: event.onlineUrl ?? "",
    startTime: toDatetimeLocal(new Date(event.startTime)),
    endTime: toDatetimeLocal(new Date(event.endTime)),
    venueName: event.venueName,
    address: event.address,
    city: event.city,
    lat: event.lat ? String(event.lat) : "",
    lng: event.lng ? String(event.lng) : "",
    maxAttendees: event.maxAttendees ? String(event.maxAttendees) : "",
    priceNaira: event.priceCents ? String(event.priceCents / 100) : "",
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

export function EventForm({
  event,
  eventId,
  isVerifiedHost,
  latestHostStatus,
}: {
  event?: Event;
  eventId?: string;
  isVerifiedHost: boolean;
  latestHostStatus: "pending" | "approved" | "denied" | null;
}) {
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

    if (!form.title.trim() || !form.startTime || !form.endTime) {
      setError("Fill in the required fields.");
      return;
    }
    if (form.format !== "online" && !form.venueName.trim()) {
      setError("Venue name is required.");
      return;
    }
    if (form.format !== "in_person" && !form.onlineUrl.trim()) {
      setError("Add a meeting link for an online or hybrid event.");
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
      format: form.format,
      onlineUrl: form.format === "in_person" ? undefined : form.onlineUrl.trim(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      venueName: form.venueName.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      lat: form.lat ? Number(form.lat) : 0,
      lng: form.lng ? Number(form.lng) : 0,
      maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null,
      priceCents: form.priceNaira ? Math.round(Number(form.priceNaira) * 100) : 0,
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

  if (!isVerifiedHost) {
    return <VerificationRequestCard requestType="host" isVerified={false} latestStatus={latestHostStatus} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 md:gap-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Cover image
        </h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {form.coverImageUrl ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-secondary sm:h-24 sm:w-40 sm:rounded-lg">
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
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-border/60 text-xs text-muted-foreground sm:h-24 sm:w-40 sm:rounded-lg">
              No image
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:rounded-md"
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

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
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
            className="resize-none rounded-2xl text-base md:rounded-md md:text-sm"
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
            <label htmlFor="isPrivate" className="flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 md:rounded-lg md:border-0 md:bg-transparent md:px-0">
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

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
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

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Location
        </h2>
        <FieldWrapper label="Format" htmlFor="format" required>
          <div className="grid grid-cols-3 gap-2">
            {EVENT_FORMAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                id={option.value === "in_person" ? "format" : undefined}
                aria-pressed={form.format === option.value}
                onClick={() => update("format", option.value)}
                className={cn(
                  "min-h-11 rounded-xl border px-3 text-sm font-medium transition-colors md:rounded-lg",
                  form.format === option.value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border/60 bg-background text-muted-foreground hover:border-neon-pink/60 hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FieldWrapper>

        {form.format !== "online" && (
          <>
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
          </>
        )}

        {form.format !== "in_person" && (
          <FieldWrapper label="Meeting link" htmlFor="onlineUrl" required>
            <Input
              id="onlineUrl"
              type="url"
              placeholder="https://..."
              value={form.onlineUrl}
              onChange={(e) => update("onlineUrl", e.target.value)}
              maxLength={500}
            />
          </FieldWrapper>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
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
          <FieldWrapper label="Price, NGN (optional)" htmlFor="price">
            <Input
              id="price"
              type="number"
              min={0}
              step="0.01"
              placeholder="Free"
              value={form.priceNaira}
              onChange={(e) => update("priceNaira", e.target.value)}
            />
          </FieldWrapper>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lift backdrop-blur sm:static sm:flex-row sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <Button type="submit" disabled={submitting || uploading} className="h-12">
          {submitting ? "Saving..." : eventId ? "Save changes" : "Create event"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/events/manage")} className="h-12">
          Cancel
        </Button>
      </div>
    </form>
  );
}
