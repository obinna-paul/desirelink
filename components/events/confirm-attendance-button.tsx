"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ConfirmAttendanceButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="text-xs text-muted-foreground">Thanks — the host has been paid.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Your ticket payment is held in escrow
      </p>
      <p className="text-xs text-muted-foreground">
        Once you&apos;ve attended, confirm below to release payment to the host — or it releases automatically
        after a short grace period.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const res = await fetch(`/api/events/${eventId}/confirm-attendance`, { method: "POST" });
          setPending(false);
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            setError(body?.error ?? "Couldn't confirm right now.");
            return;
          }
          setDone(true);
          router.refresh();
        }}
      >
        {pending ? "Confirming..." : "Confirm attendance & release payment"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
