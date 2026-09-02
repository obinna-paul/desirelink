"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gift,
  Heart,
  ListChecks,
  ShieldCheck,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GiftPicker, type SendGiftOutcome } from "@/components/hearts/gift-picker";
import { cn } from "@/lib/utils";

export type LiveRequestOptionView = { id: string; label: string; hearts: number };
export type LiveRequestView = {
  id: string;
  label: string;
  hearts: number;
  status: "pending" | "accepted" | "completed" | "declined" | "expired" | "refunded";
  createdAt: string;
  expiresAt: string;
  requester: { id: string; username: string; displayName: string; avatarUrl: string };
};

function SheetShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center lg:items-stretch lg:justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/[0.65] backdrop-blur-[2px]" aria-label={`Close ${title}`} />
      <section className="relative flex max-h-[82dvh] w-full flex-col rounded-t-lg border-t border-white/10 bg-[#121212] text-white shadow-2xl lg:h-dvh lg:max-h-none lg:max-w-[420px] lg:rounded-none lg:border-l lg:border-t-0">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20 lg:hidden" aria-hidden="true" />
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-4 lg:px-5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center text-white/65 transition-colors hover:text-white" aria-label={`Close ${title}`}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function LiveGiftTray({
  open,
  onClose,
  balance,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  balance: number;
  onSend: (hearts: number) => Promise<SendGiftOutcome>;
}) {
  return (
    <SheetShell open={open} onClose={onClose} title="Send a gift">
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 lg:px-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-sm text-white/55">Your balance</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{balance.toLocaleString()} hearts</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-fuchsia-500/[0.15] text-fuchsia-300">
            <Gift className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <GiftPicker initialBalance={balance} onSend={onSend} theme="dark" showBalance={false} />
        <p className="flex items-start gap-2 text-xs leading-5 text-white/45">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Gifts support the creator immediately and cannot be refunded.
        </p>
      </div>
    </SheetShell>
  );
}

export function ViewerRequestSheet({
  open,
  onClose,
  streamId,
  options,
  balance,
  requests,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  streamId: string;
  options: LiveRequestOptionView[];
  balance: number;
  requests: LiveRequestView[];
  onCreated: (request: LiveRequestView, spent: number) => void;
}) {
  const [selected, setSelected] = useState<LiveRequestOptionView | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = requests.filter((request) => request.status === "pending" || request.status === "accepted");

  async function submitRequest() {
    if (!selected) return;
    setPending(true);
    setError(null);
    const response = await fetch(`/api/live/${streamId}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: selected.id }),
    });
    const body = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "Couldn't send that request.");
      return;
    }
    onCreated(body.request, selected.hearts);
    setSelected(null);
  }

  return (
    <SheetShell open={open} onClose={onClose} title="Make a request">
      <div className="flex-1 overflow-y-auto">
        {active.length > 0 && (
          <div className="border-b border-white/10 px-4 py-4 lg:px-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">In progress</p>
            <div className="space-y-2">
              {active.map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.06] px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{request.label}</p>
                    <p className="mt-0.5 text-xs text-white/45">{request.status === "accepted" ? "Accepted by creator" : "Waiting for creator"}</p>
                  </div>
                  {request.status === "accepted" ? <Check className="h-5 w-5 text-emerald-400" aria-hidden="true" /> : <Clock3 className="h-5 w-5 text-amber-300" aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="divide-y divide-white/10 px-4 lg:px-5">
          {options.map((option) => (
            <button key={option.id} type="button" onClick={() => { setSelected(option); setError(null); }} className="flex min-h-[68px] w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:text-fuchsia-200">
              <span className="min-w-0 text-sm font-medium">{option.label}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums text-fuchsia-300">
                <Heart className="h-4 w-4" fill="currentColor" aria-hidden="true" /> {option.hearts.toLocaleString()}
                <ChevronRight className="ml-1 h-4 w-4 text-white/30" aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="border-t border-white/10 bg-[#171717] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 lg:px-5 lg:pb-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{selected.label}</p>
              <p className="mt-1 text-xs text-white/50">Hearts are held until the request is completed.</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-fuchsia-300"><Heart className="h-4 w-4" fill="currentColor" aria-hidden="true" />{selected.hearts.toLocaleString()}</span>
          </div>
          {error && <p role="alert" className="mb-3 text-sm text-red-300">{error} {balance < selected.hearts && <Link href="/wallet" className="underline">Buy hearts</Link>}</p>}
          <button type="button" disabled={pending} onClick={submitRequest} className="min-h-12 w-full rounded-lg bg-fuchsia-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-fuchsia-500 disabled:opacity-50">
            {pending ? "Sending request..." : "Confirm request"}
          </button>
        </div>
      )}
    </SheetShell>
  );
}

export function CreatorRequestQueue({
  open,
  onClose,
  requests,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  requests: LiveRequestView[];
  onUpdated: (request: LiveRequestView) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sorted = useMemo(
    () => [...requests].sort((a, b) => {
      const weight = { pending: 0, accepted: 1, completed: 2, declined: 3, expired: 4, refunded: 5 };
      return weight[a.status] - weight[b.status] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    [requests],
  );

  async function act(requestId: string, action: "accept" | "decline" | "complete") {
    setPendingId(requestId);
    setError(null);
    const response = await fetch(`/api/live/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await response.json().catch(() => null);
    setPendingId(null);
    if (!response.ok) {
      setError(body?.error ?? "Couldn't update that request.");
      return;
    }
    onUpdated(body.request);
  }

  return (
    <SheetShell open={open} onClose={onClose} title="Request queue">
      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-5">
        {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
        {sorted.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center text-center">
            <ListChecks className="h-8 w-8 text-white/25" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium">No requests yet</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-white/45">Paid requests will arrive here without interrupting your stream.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {sorted.map((request) => (
              <article key={request.id} className="py-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0 border border-white/10">
                    <AvatarImage src={request.requester.avatarUrl} alt="" />
                    <AvatarFallback>{request.requester.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">{request.label}</p><p className="mt-0.5 truncate text-xs text-white/45">{request.requester.displayName}</p></div>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-fuchsia-300"><Heart className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />{request.hearts.toLocaleString()}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {request.status === "pending" && <><ActionButton disabled={pendingId === request.id} onClick={() => act(request.id, "accept")}>Accept</ActionButton><ActionButton muted disabled={pendingId === request.id} onClick={() => act(request.id, "decline")}>Decline</ActionButton></>}
                      {request.status === "accepted" && <><ActionButton disabled={pendingId === request.id} onClick={() => act(request.id, "complete")}>Mark complete</ActionButton><ActionButton muted disabled={pendingId === request.id} onClick={() => act(request.id, "decline")}>Refund</ActionButton></>}
                      {request.status === "completed" && <span className="flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Completed</span>}
                      {(request.status === "declined" || request.status === "expired" || request.status === "refunded") && <span className="text-xs capitalize text-white/40">{request.status}</span>}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </SheetShell>
  );
}

function ActionButton({ children, muted = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { muted?: boolean }) {
  return <button type="button" {...props} className={cn("min-h-10 rounded-lg px-4 text-xs font-semibold transition-colors disabled:opacity-40", muted ? "bg-white/[0.08] text-white/[0.65] hover:bg-white/[0.12]" : "bg-white text-black hover:bg-white/[0.85]", props.className)}>{children}</button>;
}
