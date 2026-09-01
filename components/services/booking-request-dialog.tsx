"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EscrowNotice } from "@/components/payments/escrow-notice";
import { formatCents } from "@/lib/creator";
import { useFocusTrap } from "@/lib/use-focus-trap";

/** Earliest a booking can be requested for — an hour out, so same-day slots are still allowed. */
function minDateTimeLocal(): string {
  const min = new Date(Date.now() + 60 * 60 * 1000);
  min.setSeconds(0, 0);
  min.setMinutes(min.getMinutes() - min.getTimezoneOffset());
  return min.toISOString().slice(0, 16);
}

export function BookingRequestDialog({
  listingId,
  title,
  priceCents,
}: {
  listingId: string;
  title: string;
  priceCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [requestedAt, setRequestedAt] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function openDialog() {
    setRequestedAt("");
    setNote("");
    setError(null);
    setSubmitted(false);
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!requestedAt) {
      setError("Choose a date and time.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/service-listings/${listingId}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedAt: new Date(requestedAt).toISOString(), note }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setSubmitting(false);
      setError(body?.error ?? "Couldn't send that booking request. Try again.");
      return;
    }
    if (body?.state === "checkout" && body?.checkoutUrl) {
      window.location.href = body.checkoutUrl;
      return;
    }
    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <>
      <Button type="button" variant="default" size="sm" className="gap-1.5" onClick={openDialog}>
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Request booking
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-dialog-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="booking-dialog-title" className="text-sm font-semibold">
                Request: {title}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-sm font-medium">Booking request sent</p>
                <p className="text-xs text-muted-foreground">
                  Your payment of {formatCents(priceCents)} is held safely in escrow while the provider reviews
                  your request. You&apos;ll be notified the moment they respond.
                </p>
                <Button type="button" size="sm" className="w-full sm:w-auto" asChild>
                  <a href="/services/bookings">View my bookings</a>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="booking-time" className="text-xs font-medium text-muted-foreground">
                    Requested date &amp; time
                  </label>
                  <Input
                    id="booking-time"
                    type="datetime-local"
                    min={minDateTimeLocal()}
                    value={requestedAt}
                    onChange={(e) => setRequestedAt(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="booking-note" className="text-xs font-medium text-muted-foreground">
                    Note for the provider (optional)
                  </label>
                  <Textarea
                    id="booking-note"
                    rows={3}
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything they should know before accepting..."
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Total due now</span>
                  <span className="font-semibold text-primary">{formatCents(priceCents)}</span>
                </div>
                <EscrowNotice subject="payment" />
                {error && (
                  <p role="alert" className="text-xs text-destructive">
                    {error}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
                  <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={submitting}>
                    {submitting ? "Sending..." : `Pay ${formatCents(priceCents)} & request`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
