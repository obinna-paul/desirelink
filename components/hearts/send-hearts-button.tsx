"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GiftPicker, type SendGiftOutcome } from "@/components/hearts/gift-picker";

export function SendHeartsButton({ providerId, initialBalance }: { providerId: string; initialBalance: number }) {
  const [open, setOpen] = useState(false);

  async function sendHearts(hearts: number): Promise<SendGiftOutcome> {
    const res = await fetch(`/api/providers/${providerId}/gift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearts, context: "profile" }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: body?.error ?? "Couldn't send that gift." };
    }
    return { ok: true, heartsBalance: body.heartsBalance };
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 flex-1 gap-1.5 sm:flex-none"
        aria-pressed={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Heart className="h-4 w-4 text-neon-pink" aria-hidden="true" fill="currentColor" /> Send hearts
      </Button>
      {open && (
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <GiftPicker initialBalance={initialBalance} onSend={sendHearts} />
        </div>
      )}
    </div>
  );
}
