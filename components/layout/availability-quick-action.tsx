"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Zap } from "lucide-react";
import type { AvailabilityStatusType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  AVAILABILITY_DURATION_OPTIONS,
  AVAILABILITY_STATUS_LABELS,
  AVAILABILITY_STATUS_OPTIONS,
  DEFAULT_AVAILABILITY_DURATION_HOURS,
} from "@/lib/availability-options";

export type ActiveStatus = { status: AvailabilityStatusType; expiresAt: string } | null;

type AvailabilityResponse = { status: ActiveStatus };

function formatExpiry(expiresAt: string) {
  return new Date(expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

async function fetchAvailability(url: string): Promise<AvailabilityResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Availability could not be loaded");
  }

  return res.json();
}

function AvailabilityQuickActionComponent({ initialStatus }: { initialStatus: ActiveStatus }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<AvailabilityStatusType>(
    initialStatus?.status ?? "available_tonight"
  );
  const [durationHours, setDurationHours] = useState(DEFAULT_AVAILABILITY_DURATION_HOURS);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, mutate } = useSWR<AvailabilityResponse>("/api/availability", fetchAvailability, {
    fallbackData: { status: initialStatus },
    dedupingInterval: 30_000,
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });
  const activeStatus = data?.status ?? null;
  const currentStatusLabel = useMemo(
    () => (activeStatus ? AVAILABILITY_STATUS_LABELS[activeStatus.status] : null),
    [activeStatus]
  );
  const expiryLabel = useMemo(
    () => (activeStatus ? formatExpiry(activeStatus.expiresAt) : null),
    [activeStatus]
  );

  useFocusTrap(open, popoverRef);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function handleSet() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: selectedStatus, durationHours }),
    });
    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't set your status. Try again.");
      return;
    }

    const body = await res.json();
    mutate({ status: body.status }, { revalidate: false });
    setOpen(false);
    router.refresh();
  }

  async function handleClear() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/availability", { method: "DELETE" });
    setPending(false);

    if (!res.ok) {
      setError("Couldn't clear your status. Try again.");
      return;
    }

    mutate({ status: null }, { revalidate: false });
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={
          activeStatus
            ? `Availability status: ${currentStatusLabel}. Open to change.`
            : "Set an availability status"
        }
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Zap
          className={cn("h-5 w-5", activeStatus && "fill-neon-cyan text-neon-cyan")}
          aria-hidden="true"
        />
      </Button>

      {open && (
        <div
          ref={popoverRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Set availability status"
          className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-border/60 bg-card p-4 shadow-lg focus:outline-none"
        >
          {activeStatus && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
              <div>
                <p className="text-xs text-muted-foreground">Currently</p>
                <p className="text-sm font-medium">
                  {currentStatusLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  Until {expiryLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 px-2.5 text-xs"
                onClick={handleClear}
                disabled={pending}
              >
                Clear
              </Button>
            </div>
          )}

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Set a status
          </p>
          <div className="flex flex-col gap-1.5">
            {AVAILABILITY_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={selectedStatus === option.value}
                onClick={() => setSelectedStatus(option.value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
                  selectedStatus === option.value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border/60 bg-background text-foreground hover:border-neon-pink/60"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            <label htmlFor="availability-duration" className="text-xs text-muted-foreground">
              Expires after
            </label>
            <Select
              id="availability-duration"
              value={durationHours}
              onChange={(event) => setDurationHours(Number(event.target.value))}
              className="h-11 text-sm"
            >
              {AVAILABILITY_DURATION_OPTIONS.map((option) => (
                <option key={option.hours} value={option.hours}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <Button type="button" className="mt-3 w-full" onClick={handleSet} disabled={pending}>
            {pending ? "Saving..." : "Set status"}
          </Button>
        </div>
      )}
    </div>
  );
}

export const AvailabilityQuickAction = memo(AvailabilityQuickActionComponent);
