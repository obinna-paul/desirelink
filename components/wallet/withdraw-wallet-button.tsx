"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function WithdrawWalletButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/wallet/withdraw", { method: "POST" });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't process that withdrawal.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button type="button" onClick={withdraw} disabled={disabled || pending} className="w-fit">
        {pending ? "…" : "Withdraw to bank"}
      </Button>
    </div>
  );
}
