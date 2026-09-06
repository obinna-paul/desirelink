"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MIN_SCHEDULE_LEAD_MINUTES = 10;

function minDateTimeLocal(): string {
  const min = new Date(Date.now() + MIN_SCHEDULE_LEAD_MINUTES * 60 * 1000);
  min.setSeconds(0, 0);
  min.setMinutes(min.getMinutes() + 1);
  min.setMinutes(min.getMinutes() - min.getTimezoneOffset());
  return min.toISOString().slice(0, 16);
}

function maxDateTimeLocal(): string {
  const max = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  max.setSeconds(0, 0);
  max.setMinutes(max.getMinutes() - max.getTimezoneOffset());
  return max.toISOString().slice(0, 16);
}

export function ScheduleLiveForm({
  defaultTitle,
  onScheduled,
  onBack,
}: {
  defaultTitle: string;
  onScheduled: (stream: { id: string; title: string; scheduledFor: string }) => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [scheduledFor, setScheduledFor] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minimumDate = useMemo(minDateTimeLocal, []);
  const maximumDate = useMemo(maxDateTimeLocal, []);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const timeZoneLabel = timeZone.replaceAll("_", " ");
  const selectedDate = useMemo(() => {
    if (!scheduledFor) return null;
    const date = new Date(scheduledFor);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [scheduledFor]);

  function validateDate(): Date | null {
    if (!selectedDate) {
      setError("Choose a valid date and time.");
      return null;
    }
    if (selectedDate.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MINUTES * 60 * 1000) {
      setError(`Choose a time at least ${MIN_SCHEDULE_LEAD_MINUTES} minutes from now.`);
      return null;
    }
    if (selectedDate.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
      setError("Choose a time within the next 30 days.");
      return null;
    }
    setError(null);
    return selectedDate;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const date = validateDate();
    if (!date) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/live/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, scheduledFor: date.toISOString(), timeZone }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error ?? "Couldn't schedule your live.");
        return;
      }
      onScheduled(body.stream);
    } catch {
      setError("We couldn't reach the scheduling service. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-7 px-1 py-8 sm:py-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full pr-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
      </button>

      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-tint text-primary">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Schedule your live</h1>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
          Subscribers will be notified now, and again shortly before you go live.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="schedule-title" className="text-sm font-semibold text-foreground">
            Title
          </label>
          <Input
            id="schedule-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            autoComplete="off"
            className="h-12 rounded-xl bg-card px-4"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="schedule-time" className="text-sm font-semibold text-foreground">
            Date &amp; time
          </label>
          <Input
            id="schedule-time"
            type="datetime-local"
            min={minimumDate}
            max={maximumDate}
            value={scheduledFor}
            onChange={(event) => {
              setScheduledFor(event.target.value);
              if (error) setError(null);
            }}
            onBlur={() => {
              if (scheduledFor) validateDate();
            }}
            className="h-12 rounded-xl bg-card px-4"
            aria-describedby="schedule-time-help schedule-time-preview"
          />
          <p id="schedule-time-help" className="text-xs leading-5 text-muted-foreground">
            Times are shown in {timeZoneLabel}. Schedule between 10 minutes and 30 days from now.
          </p>
        </div>

        {selectedDate && !error && (
          <div id="schedule-time-preview" className="flex items-center gap-3 border-y border-border/70 py-4">
            <Clock3 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 text-sm">
              <span className="font-semibold text-foreground">
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(selectedDate)}
              </span>
              <span className="block text-xs text-muted-foreground">This is what your audience will see.</span>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="mt-1 w-full" aria-busy={pending}>
          {pending ? "Scheduling..." : "Schedule live"}
        </Button>
      </form>
    </div>
  );
}
