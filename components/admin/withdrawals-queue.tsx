"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";
import type { getPendingWithdrawals } from "@/lib/wallet";

type PendingWithdrawal = Awaited<ReturnType<typeof getPendingWithdrawals>>[number];

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable - the value is still selectable/visible */
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium tabular-nums">{value || "—"}</p>
      </div>
      {value && (
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

function WithdrawalRow({
  withdrawal,
  onResolve,
  pending,
  error,
}: {
  withdrawal: PendingWithdrawal;
  onResolve: (action: "paid" | "failed", reason?: string) => void;
  pending: boolean;
  error: string | null;
}) {
  const initials = withdrawal.provider.displayName.slice(0, 2).toUpperCase();
  const [revealed, setRevealed] = useState(false);
  const [confirmFail, setConfirmFail] = useState(false);
  const hasBankDetails = Boolean(withdrawal.provider.payoutAccountNumber);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-lg md:shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={withdrawal.provider.avatarUrl} alt={withdrawal.provider.displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{withdrawal.provider.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {withdrawal.provider.username} &middot;{" "}
              {formatDistanceToNow(new Date(withdrawal.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums">{formatCents(withdrawal.netAmountCents)}</p>
          </div>
          {!revealed && (
            <Button type="button" size="sm" onClick={() => setRevealed(true)}>
              Approve
            </Button>
          )}
        </div>
      </div>

      {revealed && (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
          {hasBankDetails ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <CopyableField label="Bank" value={withdrawal.provider.payoutBankName ?? ""} />
              <CopyableField label="Account number" value={withdrawal.provider.payoutAccountNumber ?? ""} />
              <CopyableField label="Account name" value={withdrawal.provider.payoutAccountName ?? ""} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
              No bank details on file for this provider.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Send {formatCents(withdrawal.netAmountCents)} from your own account, then confirm below.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!confirmFail) {
                  setConfirmFail(true);
                  return;
                }
                onResolve("failed", "Couldn't complete the manual transfer");
              }}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {pending ? "Saving..." : confirmFail ? "Confirm failed" : "Mark as failed"}
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={() => onResolve("paid")} className="gap-1.5">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {pending ? "Saving..." : "Mark as paid"}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}

export function WithdrawalsQueue({ initialWithdrawals }: { initialWithdrawals: PendingWithdrawal[] }) {
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function resolve(id: string, action: "paid" | "failed", reason?: string) {
    setBusyId(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));

    const res = await fetch(`/api/admin/withdrawals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const body = await res.json().catch(() => null);
    setBusyId(null);

    if (!res.ok) {
      setErrors((prev) => ({ ...prev, [id]: body?.error ?? "Couldn't update this withdrawal." }));
      return;
    }

    setWithdrawals((prev) => prev.filter((withdrawal) => withdrawal.id !== id));
    router.refresh();
  }

  if (withdrawals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
        No pending withdrawal requests.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {withdrawals.map((withdrawal) => (
        <WithdrawalRow
          key={withdrawal.id}
          withdrawal={withdrawal}
          pending={busyId === withdrawal.id}
          error={errors[withdrawal.id] || null}
          onResolve={(action, reason) => resolve(withdrawal.id, action, reason)}
        />
      ))}
    </ul>
  );
}
