"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";
import type { getPendingWithdrawals } from "@/lib/wallet";

type PendingWithdrawal = Awaited<ReturnType<typeof getPendingWithdrawals>>[number];

function WithdrawalRow({
  withdrawal,
  onApprove,
  pending,
  error,
}: {
  withdrawal: PendingWithdrawal;
  onApprove: () => void;
  pending: boolean;
  error: string | null;
}) {
  const initials = withdrawal.provider.displayName.slice(0, 2).toUpperCase();

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
              @{withdrawal.provider.username} &middot;{" "}
              {formatDistanceToNow(new Date(withdrawal.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums">{formatCents(withdrawal.netAmountCents)}</p>
            <p className="text-xs text-muted-foreground">
              from {formatCents(withdrawal.amountCents)}, {formatCents(withdrawal.feeCents)} fee
            </p>
          </div>
          <Button type="button" size="sm" disabled={pending} onClick={onApprove}>
            {pending ? "Approving…" : "Approve"}
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}

export function WithdrawalsQueue({ initialWithdrawals }: { initialWithdrawals: PendingWithdrawal[] }) {
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function approve(id: string) {
    setApprovingId(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));

    const res = await fetch(`/api/admin/withdrawals/${id}`, { method: "PATCH" });
    const body = await res.json().catch(() => null);
    setApprovingId(null);

    if (!res.ok) {
      setErrors((prev) => ({ ...prev, [id]: body?.error ?? "Couldn't approve this withdrawal." }));
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
          pending={approvingId === withdrawal.id}
          error={errors[withdrawal.id] || null}
          onApprove={() => approve(withdrawal.id)}
        />
      ))}
    </ul>
  );
}
