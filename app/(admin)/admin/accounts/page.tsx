import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { searchAccounts } from "@/lib/admin/accounts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "view_accounts");
  if (!gate.ok) {
    notFound();
  }

  const query = searchParams?.q?.trim() ?? "";
  const results = query ? await searchAccounts(query, 30) : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search by username, display name, or email.</p>
      </div>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search accounts..."
          autoFocus
          className="h-11 flex-1 rounded-lg border border-input bg-background px-3.5 text-sm outline-none focus-visible:border-primary/60"
        />
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Search
        </button>
      </form>

      {query && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          No accounts match &ldquo;{query}&rdquo;.
        </div>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((account) => (
            <li key={account.id}>
              <Link
                href={`/admin/accounts/${account.username}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-colors hover:border-primary/40"
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
