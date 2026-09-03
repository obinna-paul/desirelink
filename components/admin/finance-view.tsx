"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { CircleDollarSign } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";
import { cn } from "@/lib/utils";

export type EscrowBooking = {
  id: string;
  priceCents: number;
  createdAt: string;
  listingTitle: string;
  provider: { username: string; displayName: string };
  customer: { username: string; displayName: string };
};

export type LedgerRow = {
  id: string;
  amountCents: number;
  status: string;
  provider: string;
  escrowStatus: string | null;
  createdAt: string;
  profile: { username: string; displayName: string } | null;
};

export type PayoutHistoryRow = {
  id: string;
  netAmountCents: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  provider: { username: string; displayName: string };
};

export type HeartsSummary = {
  heartsPurchased: number;
  revenueFromHeartsCents: number;
  purchaseCount: number;
  heartsGifted: number;
  giftValueCents: number;
  giftCount: number;
};

const TABS = ["Escrow", "Payout history", "Transactions", "Hearts"] as const;
type Tab = (typeof TABS)[number];

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EscrowRow({ booking, onResolved }: { booking: EscrowBooking; onResolved: (id: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"release" | "refund" | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function release() {
    setBusy("release");
    setError(null);
    const res = await fetch(`/api/admin/finance/escrow/${booking.id}/release`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) {
      setError(body?.error ?? "Couldn't release this escrow.");
      return;
    }
    onResolved(booking.id);
    router.refresh();
  }

  async function refund() {
    if (!confirmRefund) {
      setConfirmRefund(true);
      return;
    }
    setBusy("refund");
    setError(null);
    const res = await fetch(`/api/admin/finance/escrow/${booking.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Resolved via admin finance dispute review" }),
    });
    const body = await res.json().catch(() => null);
    setBusy(null);
    setConfirmRefund(false);
    if (!res.ok) {
      setError(body?.error ?? "Couldn't refund this escrow.");
      return;
    }
    onResolved(booking.id);
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{booking.listingTitle}</p>
          <p className="text-xs text-muted-foreground">
            {booking.customer.username} &rarr; {booking.provider.username} &middot; held{" "}
            {formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true })}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums">{formatCents(booking.priceCents)}</span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" disabled={Boolean(busy)} onClick={release}>
          {busy === "release" ? "Releasing..." : "Release to creator"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={Boolean(busy)} onClick={refund}>
          {busy === "refund" ? "Refunding..." : confirmRefund ? "Confirm refund" : "Refund customer"}
        </Button>
      </div>
    </li>
  );
}

export function FinanceView({
  escrow,
  payoutHistory,
  transactions,
  hearts,
}: {
  escrow: EscrowBooking[];
  payoutHistory: PayoutHistoryRow[];
  transactions: LedgerRow[];
  hearts: HeartsSummary;
}) {
  const [tab, setTab] = useState<Tab>("Escrow");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const visibleEscrow = escrow.filter((b) => !resolvedIds.has(b.id));

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Finance sections" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item}
            {item === "Escrow" && visibleEscrow.length > 0 && ` (${visibleEscrow.length})`}
          </button>
        ))}
      </div>

      {tab === "Escrow" &&
        (visibleEscrow.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
            <CircleDollarSign className="mx-auto h-5 w-5" aria-hidden="true" />
            <span className="mx-auto">No held escrow needs attention.</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleEscrow.map((booking) => (
              <EscrowRow key={booking.id} booking={booking} onResolved={(id) => setResolvedIds((prev) => new Set(prev).add(id))} />
            ))}
          </ul>
        ))}

      {tab === "Payout history" &&
        (payoutHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payouts yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {payoutHistory.map((w) => (
              <li key={w.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span>{w.provider.username}</span>
                <span className="tabular-nums">{formatCents(w.netAmountCents)}</span>
                <Badge variant={w.status === "paid" ? "trust" : w.status === "failed" ? "outline" : "outline"} className={cn(w.status === "failed" && "text-destructive")}>
                  {w.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(w.createdAt), { addSuffix: true })}</span>
              </li>
            ))}
          </ul>
        ))}

      {tab === "Transactions" &&
        (transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {transactions.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{t.profile?.username ?? "—"}</span>
                <span className="tabular-nums">{formatCents(t.amountCents)}</span>
                <span className="text-xs capitalize text-muted-foreground">
                  {t.provider} &middot; {t.status}
                  {t.escrowStatus ? ` · escrow ${t.escrowStatus}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}</span>
              </li>
            ))}
          </ul>
        ))}

      {tab === "Hearts" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Hearts purchased" value={hearts.heartsPurchased.toLocaleString()} />
          <StatCard label="Revenue from hearts" value={formatCents(hearts.revenueFromHeartsCents)} />
          <StatCard label="Purchases" value={hearts.purchaseCount} />
          <StatCard label="Hearts gifted" value={hearts.heartsGifted.toLocaleString()} />
          <StatCard label="Gift value" value={formatCents(hearts.giftValueCents)} />
          <StatCard label="Gifts sent" value={hearts.giftCount} />
        </div>
      )}
    </div>
  );
}
