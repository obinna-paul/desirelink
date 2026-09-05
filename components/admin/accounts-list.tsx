"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export type AccountListRow = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  profileType: string;
  isVerified: boolean;
  isVerifiedCreator: boolean;
  isSuspended: boolean;
  user: { email: string };
};

/**
 * One click + a native confirm() is deliberately less ceremony than the full account
 * page's type-the-username panel - this list is where bulk-cleaning a batch of test
 * accounts actually happens, and requiring a full detail-page visit per account for that
 * would defeat the point. The stronger safeguard still exists on the account's own page
 * for a single deliberate deletion.
 */
export function AccountsList({ accounts, canDelete }: { accounts: AccountListRow[]; canDelete: boolean }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function quickDelete(account: AccountListRow) {
    if (!window.confirm(`Permanently delete @${account.username}? This can't be undone.`)) {
      return;
    }
    setDeletingId(account.id);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${account.id}/delete`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setDeletingId(null);
    if (!res.ok) {
      setError(`@${account.username}: ${body?.error ?? "Couldn't delete this account."}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {accounts.map((account) => (
          <li key={account.id} className="flex items-center gap-2">
            <Link
              href={`/admin/accounts/${account.username}`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-colors hover:border-primary/40"
            >
              <Avatar className="h-10 w-10 border border-border">
                <AvatarImage src={account.avatarUrl} alt={account.displayName} />
                <AvatarFallback className="text-xs">{initials(account.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{account.username}</p>
                  {account.isSuspended && (
                    <Badge variant="outline" className="border-destructive/40 text-destructive">
                      Suspended
                    </Badge>
                  )}
                  {(account.isVerified || account.isVerifiedCreator) && <Badge variant="neon">Verified</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {account.displayName} &middot; {account.user.email}
                </p>
              </div>
              <span className="shrink-0 text-xs capitalize text-muted-foreground">{account.profileType.toLowerCase()}</span>
            </Link>
            {canDelete && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Delete @${account.username}`}
                disabled={deletingId === account.id}
                onClick={() => quickDelete(account)}
                className="h-11 w-11 shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
