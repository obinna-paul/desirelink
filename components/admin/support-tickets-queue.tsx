"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import type { SupportTicket } from "@prisma/client";

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/admin/support/${ticket.id}`, { method: "PATCH" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setPending(false);
      setError(body?.error ?? "Couldn't resolve this ticket.");
      return;
    }
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-xl md:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{ticket.subject}</h2>
          <p className="text-xs text-muted-foreground">
            {ticket.email} · {formatDistanceToNow(ticket.createdAt, { addSuffix: true })}
          </p>
        </div>
        <Button size="sm" disabled={pending} onClick={resolve}>
          {pending ? "..." : "Mark resolved"}
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground/90">{ticket.message}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}

export function SupportTicketsQueue({ tickets }: { tickets: SupportTicket[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {tickets.map((ticket) => (
        <TicketRow key={ticket.id} ticket={ticket} />
      ))}
    </ul>
  );
}
