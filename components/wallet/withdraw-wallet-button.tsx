"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";

export function WithdrawWalletButton({ disabled }: { disabled: boolean }) {
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

    setSuccess(`${formatCents(body.netAmountCents)} is on its way to your bank (${formatCents(body.feeCents)} fee).`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {success && <p className="text-xs text-neon-cyan">{success}</p>}
      <Button type="button" onClick={withdraw} disabled={disabled || pending} className="w-fit">
        {pending ? "…" : "Withdraw to bank"}
      </Button>
    </div>
  );
}
