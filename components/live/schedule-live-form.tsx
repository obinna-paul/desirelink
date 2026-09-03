"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Earliest a stream can be scheduled for - 15 minutes out, so it's never "in the past" by
 * the time the request lands. Server-side scheduleLiveStream enforces the real minimum. */
function minDateTimeLocal(): string {
  const min = new Date(Date.now() + 15 * 60 * 1000);
  min.setSeconds(0, 0);
  min.setMinutes(min.getMinutes() - min.getTimezoneOffset());
  return min.toISOString().slice(0, 16);
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!scheduledFor) {
      setError("Choose a date and time.");
      return;
    }

    setPending(true);
    setError(null);
    const res = await fetch("/api/live/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, scheduledFor: new Date(scheduledFor).toISOString() }),
    });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't schedule your live.");
      return;
    }
    onScheduled(body.stream);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 py-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
      </button>

      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Schedule your live</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscribers will be notified now, and again shortly before you go live.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="schedule-title" className="text-xs font-medium text-muted-foreground">
            Title
          </label>
          <Input id="schedule-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="schedule-time" className="text-xs font-medium text-muted-foreground">
            Date &amp; time
          </label>
          <Input
            id="schedule-time"
            type="datetime-local"
            min={minDateTimeLocal()}
            value={scheduledFor}
            onChange={(event) => setScheduledFor(event.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Scheduling..." : "Schedule live"}
        </Button>
      </form>
    </div>
  );
}
