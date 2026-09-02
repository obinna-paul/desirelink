"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/creator";

export function WithdrawWalletButton({ disabled, className }: { disabled: boolean; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function withdraw() {
    setPending(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/wallet/withdraw", { method: "POST" });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't process that withdrawal.");
      return;
    }

    setSuccess(
      `Withdrawal requested: ${formatCents(body.netAmountCents)} (${formatCents(body.feeCents)} fee). Reviewed and paid out within 2–3 business days.`
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/15 px-2.5 py-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-primary-foreground/10 px-2.5 py-1.5 text-xs font-medium">{success}</p>
      )}
      <Button type="button" onClick={withdraw} disabled={disabled || pending} className={cn("w-fit", className)}>
        {pending ? "…" : "Withdraw to bank"}
      </Button>
    </div>
  );
}
