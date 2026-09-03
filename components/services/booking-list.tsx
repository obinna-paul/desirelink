"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { BriefcaseBusiness, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/creator";

export type BookingListItem = {
  id: string;
  requestedAt: string;
  note: string;
  priceCents: number;
  status: "pending_payment" | "pending_provider" | "confirmed" | "declined" | "cancelled" | "completed";
  declineReason: string | null;
  listing: { title: string; coverImageUrl: string | null };
  provider: { username: string; displayName: string; avatarUrl: string };
  customer: { username: string; displayName: string; avatarUrl: string };
};

const STATUS_LABEL: Record<BookingListItem["status"], string> = {
  pending_payment: "Awaiting payment",
  pending_provider: "Awaiting creator response",
  confirmed: "Confirmed",
  declined: "Declined — refunded",
  cancelled: "Cancelled — refunded",
  completed: "Completed",
};

const STATUS_VARIANT: Record<BookingListItem["status"], "default" | "outline" | "secondary"> = {
  pending_payment: "outline",
  pending_provider: "secondary",
  confirmed: "default",
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

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                {formatCents(booking.priceCents)}
                {(booking.status === "pending_provider" || booking.status === "confirmed") && (
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
                {role === "customer" && (booking.status === "pending_provider" || booking.status === "confirmed") && (
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
                    label="Confirm service delivered"
                    action="complete"
                    bookingId={booking.id}
                    onDone={() => router.refresh()}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
