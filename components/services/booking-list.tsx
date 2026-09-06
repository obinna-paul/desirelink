"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { BriefcaseBusiness, CheckCircle2, Clock3, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/creator";

export type BookingListItem = {
  id: string;
  requestedAt: string;
  note: string;
  priceCents: number;
  status: "pending_payment" | "pending_provider" | "confirmed" | "refund_requested" | "declined" | "cancelled" | "completed";
  declineReason: string | null;
  refundRequestedAt: string | null;
  refundReason: string | null;
  transaction: { escrowStatus: string | null } | null;
  listing: { title: string; coverImageUrl: string | null };
  provider: { username: string; displayName: string; avatarUrl: string };
  customer: { username: string; displayName: string; avatarUrl: string };
};

const STATUS_LABEL: Record<BookingListItem["status"], string> = {
  pending_payment: "Awaiting payment",
  pending_provider: "Awaiting creator response",
  confirmed: "Confirmed",
  refund_requested: "Under review",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

const STATUS_VARIANT: Record<BookingListItem["status"], "default" | "outline" | "secondary"> = {
  pending_payment: "outline",
  pending_provider: "secondary",
  confirmed: "default",
  refund_requested: "secondary",
  declined: "outline",
  cancelled: "outline",
  completed: "default",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function patchBooking(id: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/service-bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => null);
  return { ok: false, error: data?.error ?? "Something went wrong. Try again." };
}

function DeclineControl({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
        Decline
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-border/60 p-2.5">
      <Textarea
        rows={2}
        maxLength={500}
        placeholder="Let the customer know why (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-destructive"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const result = await patchBooking(bookingId, { action: "decline", reason });
            setPending(false);
            if (!result.ok) {
              setError(result.error ?? "Couldn't decline this booking.");
              return;
            }
            onDone();
          }}
        >
          {pending ? "Declining..." : "Confirm decline & refund"}
        </Button>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  action,
  bookingId,
  variant = "default",
  onDone,
}: {
  label: string;
  action: "accept" | "cancel" | "complete";
  bookingId: string;
  variant?: "default" | "outline";
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await patchBooking(bookingId, { action });
          setPending(false);
          if (!result.ok) {
            setError(result.error ?? "Something went wrong.");
            return;
          }
          onDone();
        }}
      >
        {pending ? "Working..." : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RefundRequestControl({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" className="min-h-10" onClick={() => setOpen(true)}>
        Report a problem
      </Button>
    );
  }

  return (
    <div className="w-full border-t border-border/50 pt-3">
      <label htmlFor={`refund-reason-${bookingId}`} className="text-sm font-medium">
        What went wrong?
      </label>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Payment will stay locked while Udala reviews your request.
      </p>
      <Textarea
        id={`refund-reason-${bookingId}`}
        rows={3}
        minLength={10}
        maxLength={500}
        className="mt-2 resize-none"
        placeholder="Describe what happened so our team can review it fairly."
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Keep booking
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={pending || reason.trim().length < 10}
          onClick={async () => {
            setPending(true);
            setError(null);
            const result = await patchBooking(bookingId, { action: "request_refund", reason });
            setPending(false);
            if (!result.ok) {
              setError(result.error ?? "Couldn't open a refund review.");
              return;
            }
            onDone();
          }}
        >
          {pending ? "Submitting..." : "Request refund review"}
        </Button>
      </div>
    </div>
  );
}

function EscrowStatus({ booking }: { booking: BookingListItem }) {
  const refundProcessing = booking.transaction?.escrowStatus === "refund_pending";
  const released = booking.transaction?.escrowStatus === "released" || booking.status === "completed";
  const refunded = booking.transaction?.escrowStatus === "refunded";
  const review = booking.status === "refund_requested";

  const Icon = released || refunded ? CheckCircle2 : review ? TriangleAlert : refundProcessing || booking.status === "pending_payment" ? Clock3 : LockKeyhole;
  const title = refundProcessing
    ? "Refund processing"
    : released
    ? "Payment released"
    : refunded
      ? "Payment refunded"
      : review
        ? "Payment held for review"
        : booking.status === "pending_payment"
          ? "Waiting for payment"
          : "Payment secured";
  const detail = refundProcessing
    ? "The payment provider is processing the refund. It cannot be released to the provider."
    : released
    ? "The funds are now in the provider's wallet."
    : refunded
      ? "The held payment is no longer payable to the provider."
      : review
        ? "Udala finance has been notified. No money can move until the review is resolved."
        : booking.status === "pending_provider"
          ? "Held in escrow while the provider reviews the request."
          : booking.status === "confirmed"
            ? "Held in escrow until the customer releases it or reports a problem."
            : "Complete checkout to secure this request.";

  return (
    <div className="flex gap-2.5 border-t border-border/50 pt-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${review ? "text-amber-600" : "text-primary"}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-semibold">Escrow room · {title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        {review && booking.refundReason && (
          <p className="mt-2 text-xs text-foreground"><span className="font-medium">Issue reported:</span> {booking.refundReason}</p>
        )}
      </div>
    </div>
  );
}

export function BookingList({ role, bookings }: { role: "provider" | "customer"; bookings: BookingListItem[] }) {
  const router = useRouter();

  if (bookings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
        {role === "provider" ? "No booking requests yet." : "You haven't booked a service yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bookings.map((booking) => {
        const counterparty = role === "provider" ? booking.customer : booking.provider;
        return (
          <div key={booking.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                {booking.listing.coverImageUrl ? (
                  <Image src={booking.listing.coverImageUrl} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-semibold">{booking.listing.title}</p>
                  <Badge variant={STATUS_VARIANT[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {role === "provider" ? "Requested by" : "Creator"} {counterparty.displayName} ({counterparty.username})
                </p>
                <p className="text-xs text-muted-foreground">{formatWhen(booking.requestedAt)}</p>
                {booking.note && <p className="mt-1 text-xs text-foreground/80">&ldquo;{booking.note}&rdquo;</p>}
                {booking.declineReason && (
                  <p className="mt-1 text-xs text-destructive">Reason: {booking.declineReason}</p>
                )}
              </div>
            </div>

            <EscrowStatus booking={booking} />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                {formatCents(booking.priceCents)}
                {(booking.status === "pending_provider" || booking.status === "confirmed" || booking.status === "refund_requested") && (
                  <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" /> held in escrow
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {role === "provider" && booking.status === "pending_provider" && (
                  <>
                    <ActionButton label="Accept" action="accept" bookingId={booking.id} onDone={() => router.refresh()} />
                    <DeclineControl bookingId={booking.id} onDone={() => router.refresh()} />
                  </>
                )}
                {role === "customer" && booking.status === "pending_provider" && (
                  <ActionButton
                    label="Cancel"
                    action="cancel"
                    bookingId={booking.id}
                    variant="outline"
                    onDone={() => router.refresh()}
                  />
                )}
                {role === "customer" && booking.status === "confirmed" && (
                  <ActionButton
                    label="Release payment"
                    action="complete"
                    bookingId={booking.id}
                    onDone={() => router.refresh()}
                  />
                )}
              </div>
            </div>
            {role === "customer" && booking.status === "confirmed" && (
              <RefundRequestControl bookingId={booking.id} onDone={() => router.refresh()} />
            )}
          </div>
        );
      })}
    </div>
  );
}
