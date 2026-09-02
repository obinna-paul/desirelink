"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Ban, CheckCircle2, ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";
import { cn } from "@/lib/utils";

/** Deliberately not imported from lib/admin/accounts.ts (which is server-only) - a client
 * component can't safely pull types from a "server-only"-marked module without risking the
 * same bundling failure the report-dialog/lib/report split fixed. This is the client-side
 * contract instead, matching what the server page actually passes down. */
export type AccountRecordData = {
  profile: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    bio: string;
    profileType: string;
    city: string;
    country: string;
    isVerified: boolean;
    isVerifiedCreator: boolean;
    isVerifiedServiceProvider: boolean;
    verificationPending: boolean;
    isTrustedMember: boolean;
    isSuspended: boolean;
    suspendedAt: string | null;
    warningCount: number;
    communityStanding: number;
    heartsBalance: number;
    walletBalanceCents: number;
    createdAt: string;
    user: { email: string; isAdmin: boolean; adminRole: string | null };
  };
  stats: {
    postCount: number;
    premiumPostCount: number;
    subscriberCount: number;
    serviceListingCount: number;
    reportsPendingAgainst: number;
    reportsMade: number;
    lifetimeWithdrawnCents: number;
    paidWithdrawalCount: number;
  };
  recentTransactions: {
    id: string;
    amountCents: number;
    status: string;
    provider: string;
    createdAt: string;
  }[];
  pendingWithdrawals: {
    id: string;
    netAmountCents: number;
    status: string;
    createdAt: string;
  }[];
  notes: {
    id: string;
    body: string;
    createdAt: string;
    author: { name: string; email: string };
  }[];
  adminHistory: {
    id: string;
    action: string;
    summary: string;
    createdAt: string;
    actor: { name: string; email: string };
  }[];
};

const TABS = ["Overview", "Content", "Money", "Reports", "Notes", "Admin history"] as const;
type Tab = (typeof TABS)[number];

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AccountRecord({
  detail,
  canModerate,
  canWriteNotes,
}: {
  detail: AccountRecordData;
  canModerate: boolean;
  canWriteNotes: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const { profile, stats } = detail;

  async function suspend() {
    if (!confirmSuspend) {
      setConfirmSuspend(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${profile.id}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Suspended from account record" }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    setConfirmSuspend(false);
    if (!res.ok) {
      setError(body?.error ?? "Couldn't suspend this account.");
      return;
    }
    router.refresh();
  }

  async function reinstate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${profile.id}/reinstate`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(body?.error ?? "Couldn't reinstate this account.");
      return;
    }
    router.refresh();
  }

  async function submitNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteBody.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${profile.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteBody }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(body?.error ?? "Couldn't add that note.");
      return;
    }
    setNoteBody("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border border-border">
            <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            <AvatarFallback>{initials(profile.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-base font-semibold">{profile.username}</p>
              {profile.isVerified && (
                <Badge variant="neon" className="gap-1">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Verified
                </Badge>
              )}
              {profile.isSuspended && (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  Suspended
                </Badge>
              )}
              {profile.user.isAdmin && (
                <Badge variant="outline">{profile.user.adminRole ?? "Admin"}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {profile.displayName} &middot; {profile.user.email} &middot; {profile.profileType.toLowerCase()} &middot; joined{" "}
              {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        {canModerate && (
          <div className="flex shrink-0 gap-2">
            {profile.isSuspended ? (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={reinstate} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {busy ? "Reinstating..." : "Reinstate"}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={suspend}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                {busy ? "Suspending..." : confirmSuspend ? "Confirm suspend" : "Suspend"}
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div role="tablist" aria-label="Account sections" className="flex gap-1 overflow-x-auto border-b border-border">
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
            {item === "Reports" && stats.reportsPendingAgainst > 0 && ` (${stats.reportsPendingAgainst})`}
            {item === "Notes" && detail.notes.length > 0 && ` (${detail.notes.length})`}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Wallet balance" value={formatCents(profile.walletBalanceCents)} />
          <StatCard label="Hearts held" value={profile.heartsBalance} />
          <StatCard label="Subscribers" value={stats.subscriberCount} />
          <StatCard label="Posts (premium)" value={`${stats.postCount} (${stats.premiumPostCount})`} />
          <StatCard label="Lifetime withdrawn" value={formatCents(stats.lifetimeWithdrawnCents)} />
          <StatCard label="Reports against" value={stats.reportsPendingAgainst} />
          <StatCard label="Warnings" value={profile.warningCount} />
          <StatCard label="Community standing" value={profile.communityStanding} />
        </div>
      )}

      {tab === "Content" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Posts" value={stats.postCount} />
            <StatCard label="Premium posts" value={stats.premiumPostCount} />
            <StatCard label="Service listings" value={stats.serviceListingCount} />
          </div>
          <p className="text-xs text-muted-foreground">
            Opening an individual post or listing (including premium content) isn&apos;t wired up yet - that&apos;s the locked-content viewer in the next phase of the admin console plan.
          </p>
        </div>
      )}

      {tab === "Money" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Wallet balance" value={formatCents(profile.walletBalanceCents)} />
            <StatCard label="Hearts held" value={profile.heartsBalance} />
            <StatCard label="Lifetime withdrawn" value={formatCents(stats.lifetimeWithdrawnCents)} />
            <StatCard label="Payouts made" value={stats.paidWithdrawalCount} />
          </div>

          {detail.pendingWithdrawals.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending withdrawals</h3>
              <ul className="flex flex-col gap-1.5">
                {detail.pendingWithdrawals.map((w) => (
                  <li key={w.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <span>{formatCents(w.netAmountCents)} net</span>
                    <span className="text-xs capitalize text-muted-foreground">{w.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent transactions</h3>
            {detail.recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {detail.recentTransactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <span className="tabular-nums">{formatCents(t.amountCents)}</span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {t.provider} &middot; {t.status} &middot; {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "Reports" && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Pending reports against them" value={stats.reportsPendingAgainst} />
          <StatCard label="Reports they've made" value={stats.reportsMade} />
        </div>
      )}

      {tab === "Notes" && (
        <div className="flex flex-col gap-3">
          {canWriteNotes && (
            <form onSubmit={submitNote} className="flex flex-col gap-2">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a case note for the next person who looks at this account..."
                maxLength={2000}
                rows={3}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary/60"
              />
              <Button type="submit" size="sm" disabled={busy || !noteBody.trim()} className="self-end">
                {busy ? "Adding..." : "Add note"}
              </Button>
            </form>
          )}

          {detail.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {detail.notes.map((note) => (
                <li key={note.id} className="rounded-lg border border-border/60 p-3 text-sm">
                  <p>{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {note.author.name} &middot; {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "Admin history" && (
        <div className="flex flex-col gap-2">
          {detail.adminHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin actions recorded against this account yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {detail.adminHistory.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border/60 p-3 text-sm">
                  <p>{entry.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.actor.name} &middot; {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
