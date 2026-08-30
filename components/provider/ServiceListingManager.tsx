"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { formatCents } from "@/lib/creator";
import { SERVICE_CATEGORY_OPTIONS } from "@/lib/account-types";
import type { ServiceListingInput } from "@/lib/validations/service-listing";
import type { ServiceListingView } from "@/lib/service-listings";

type FormState = {
  title: string;
  description: string;
  category: string;
  durationMinutes: string;
  priceNaira: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: SERVICE_CATEGORY_OPTIONS[0],
  durationMinutes: "60",
  priceNaira: "",
};

function listingToForm(listing: ServiceListingView): FormState {
  return {
    title: listing.title,
    description: listing.description,
    category: listing.category,
    durationMinutes: String(listing.durationMinutes),
    priceNaira: (listing.priceCents / 100).toString(),
  };
}

function ServiceListingForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial: FormState;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (input: ServiceListingInput) => Promise<string | null>;
}) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const priceNaira = Number(form.priceNaira);
    const durationMinutes = Number(form.durationMinutes);
    if (!form.title.trim() || Number.isNaN(priceNaira) || priceNaira < 0) {
      setError("Enter a title and a valid price.");
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15) {
      setError("Duration must be at least 15 minutes.");
      return;
    }

    setStatus("saving");
    const result = await onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      durationMinutes,
      priceCents: Math.round(priceNaira * 100),
    });
    setStatus("idle");

    if (result) {
      setError(result);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-4 shadow-sm md:rounded-lg md:shadow-none"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="service-title" className="text-xs font-medium text-muted-foreground">
            Title
          </label>
          <Input
            id="service-title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="e.g. In-home massage session"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="service-category" className="text-xs font-medium text-muted-foreground">
            Category
          </label>
          <Select
            id="service-category"
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
          >
            {SERVICE_CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="service-description" className="text-xs font-medium text-muted-foreground">
          Description
        </label>
        <Textarea
          id="service-description"
          rows={2}
          className="resize-none rounded-2xl md:rounded-md"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="What is included in this service"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="service-duration" className="text-xs font-medium text-muted-foreground">
            Duration (minutes)
          </label>
          <Input
            id="service-duration"
            type="number"
            min={15}
            step="15"
            value={form.durationMinutes}
            onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="service-price" className="text-xs font-medium text-muted-foreground">
            Price (NGN)
          </label>
          <Input
            id="service-price"
            type="number"
            min={0}
            step="0.01"
            value={form.priceNaira}
            onChange={(event) => setForm((prev) => ({ ...prev, priceNaira: event.target.value }))}
            placeholder="15000.00"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:flex">
        <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function ServiceListingManager({
  initialListings,
  startCreating = false,
}: {
  initialListings: ServiceListingView[];
  startCreating?: boolean;
}) {
  const router = useRouter();
  const [listings, setListings] = useState(initialListings);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(startCreating);

  async function handleCreate(input: ServiceListingInput) {
    const res = await fetch("/api/service-listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return body?.error ?? "Couldn't create service listing.";
    }

    const { listing } = await res.json();
    setListings((prev) => [...prev, listing]);
    setCreating(false);
    router.refresh();
    return null;
  }

  async function handleUpdate(id: string, input: ServiceListingInput) {
    const res = await fetch(`/api/service-listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return body?.error ?? "Couldn't update service listing.";
    }

    setListings((prev) =>
      prev.map((listing) =>
        listing.id === id
          ? { ...listing, ...input, updatedAt: new Date() }
          : listing
      )
    );
    setEditingId(null);
    router.refresh();
    return null;
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this service listing?")) return;

    const res = await fetch(`/api/service-listings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setListings((prev) => prev.filter((listing) => listing.id !== id));
      router.refresh();
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
        Service listings
      </h2>

      {listings.length === 0 && !creating && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
          You don&apos;t have any service listings yet.
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {listings.map((listing) =>
          editingId === listing.id ? (
            <li key={listing.id}>
              <ServiceListingForm
                initial={listingToForm(listing)}
                submitLabel="Save changes"
                onCancel={() => setEditingId(null)}
                onSubmit={(input) => handleUpdate(listing.id, input)}
              />
            </li>
          ) : (
            <li
              key={listing.id}
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between md:rounded-lg md:shadow-none"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{listing.title}</p>
                  <span className="text-sm text-neon-cyan">{formatCents(listing.priceCents)}</span>
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
                    {listing.category}
                  </span>
                </div>
                {listing.description && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{listing.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{listing.durationMinutes} minutes</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 sm:w-auto"
                  onClick={() => setEditingId(listing.id)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 text-destructive sm:w-auto"
                  onClick={() => handleDelete(listing.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                </Button>
              </div>
            </li>
          )
        )}
      </ul>

      {creating ? (
        <ServiceListingForm
          initial={EMPTY_FORM}
          submitLabel="Add service"
          onCancel={() => setCreating(false)}
          onSubmit={handleCreate}
        />
      ) : (
        <Button type="button" variant="outline" className="w-full gap-1.5 sm:w-fit" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add service
        </Button>
      )}
    </section>
  );
}
