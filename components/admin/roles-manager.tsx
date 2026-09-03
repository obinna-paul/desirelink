"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";

const ROLES = ["SUPPORT", "MODERATOR", "FINANCE", "SUPERADMIN"] as const;

export type AdminRow = {
  id: string;
  name: string;
  email: string;
  adminRole: string | null;
  createdAt: string;
};

function AdminRoleRow({ admin, isSelf, onChanged }: { admin: AdminRow; isSelf: boolean; onChanged: () => void }) {
  const router = useRouter();
  const [role, setRole] = useState(admin.adminRole ?? "SUPERADMIN");
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateRole(nextRole: string) {
    setRole(nextRole);
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/roles/${admin.id}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(body?.error ?? "Couldn't update role.");
      return;
    }
    router.refresh();
    onChanged();
  }

  async function revoke() {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/roles/${admin.id}/revoke`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setBusy(false);
    setConfirmRevoke(false);
    if (!res.ok) {
      setError(body?.error ?? "Couldn't revoke admin access.");
      return;
    }
    router.refresh();
    onChanged();
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {admin.name} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {admin.email} &middot; admin since {formatDistanceToNow(new Date(admin.createdAt), { addSuffix: true })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={role}
            disabled={isSelf || busy}
            onChange={(e) => updateRole(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" disabled={isSelf || busy} onClick={revoke} className="text-destructive hover:text-destructive">
            {confirmRevoke ? "Confirm" : "Revoke"}
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}

export function RolesManager({ admins, currentUserId }: { admins: AdminRow[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [grantRole, setGrantRole] = useState<(typeof ROLES)[number]>("SUPPORT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grant(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/roles/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: grantRole }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(body?.error ?? "Couldn't grant admin access.");
      return;
    }
    setEmail("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={grant} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grant admin access</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Account email"
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-primary/60"
          />
          <select
            value={grantRole}
            onChange={(e) => setGrantRole(e.target.value as (typeof ROLES)[number])}
            className="h-10 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-primary/60"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={busy || !email.trim()}>
            {busy ? "Granting..." : "Grant"}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      <ul className="flex flex-col gap-2">
        {admins.map((admin) => (
          <AdminRoleRow key={admin.id} admin={admin} isSelf={admin.id === currentUserId} onChanged={() => {}} />
        ))}
      </ul>
    </div>
  );
}
