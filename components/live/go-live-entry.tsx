"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GoLiveStaging } from "@/components/live/go-live-staging";
import { ScheduleLiveForm } from "@/components/live/schedule-live-form";
import { ScheduleLiveShareModal } from "@/components/live/schedule-live-share-modal";

type ScheduledStream = { id: string; title: string; scheduledFor: string };
type Mode = "summary" | "choice" | "schedule" | "share" | "staging";

function formatScheduledFor(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function GoLiveEntry({
  defaultTitle,
  defaultRequestOptions,
  existingScheduled,
}: {
  defaultTitle: string;
  defaultRequestOptions: Array<{ label: string; hearts: number }>;
  existingScheduled: ScheduledStream | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(existingScheduled ? "summary" : "choice");
  const [scheduled, setScheduled] = useState<ScheduledStream | null>(existingScheduled);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCancel() {
    if (!scheduled) return;
    setCancelling(true);
    setCancelError(null);
    const res = await fetch(`/api/live/${scheduled.id}/cancel-scheduled`, { method: "POST" });
    setCancelling(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setCancelError(body?.error ?? "Couldn't cancel this scheduled live.");
      return;
    }
    setScheduled(null);
    setMode("choice");
    router.refresh();
  }

  if (mode === "summary" && scheduled) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
        <CalendarClock className="h-8 w-8 text-primary" aria-hidden="true" />
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">You have a live scheduled</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scheduled.title} &middot; {formatScheduledFor(scheduled.scheduledFor)}
          </p>
        </div>

        {cancelError && (
          <p role="alert" className="text-sm text-destructive">
            {cancelError}
          </p>
        )}

        <div className="flex w-full flex-col gap-3">
          <Button type="button" onClick={() => setMode("staging")} className="w-full">
            Start now
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleCancel()} disabled={cancelling} className="w-full">
            {cancelling ? "Cancelling..." : "Cancel scheduled live"}
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "choice") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Go live</h1>
        <p className="text-sm text-muted-foreground">Start streaming right away, or schedule it for later and share the link now.</p>

        <button
          type="button"
          onClick={() => setMode("staging")}
          className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/60"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Radio className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Go live now</span>
            <span className="block text-xs text-muted-foreground">Start streaming immediately</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode("schedule")}
          className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/60"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-tint text-primary">
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Go live later</span>
            <span className="block text-xs text-muted-foreground">Pick a time and share the link now</span>
          </span>
        </button>
      </div>
    );
  }

  if (mode === "schedule") {
    return (
      <ScheduleLiveForm
        defaultTitle={defaultTitle}
        onBack={() => setMode("choice")}
        onScheduled={(stream) => {
          setScheduled(stream);
          setMode("share");
        }}
      />
    );
  }

  if (mode === "share" && scheduled) {
    return (
      <>
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
          <CalendarClock className="h-8 w-8 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Your live is scheduled for {formatScheduledFor(scheduled.scheduledFor)}.</p>
        </div>
        <ScheduleLiveShareModal stream={scheduled} onClose={() => router.push("/")} />
      </>
    );
  }

  return <GoLiveStaging defaultTitle={defaultTitle} defaultRequestOptions={defaultRequestOptions} />;
}
