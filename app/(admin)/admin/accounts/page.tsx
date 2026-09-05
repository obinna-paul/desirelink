import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getAdminContext, requireCapability } from "@/lib/admin/access";
import { listAccounts } from "@/lib/admin/accounts";
import { AccountsList } from "@/components/admin/accounts-list";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "view_accounts");
  if (!gate.ok) {
    notFound();
  }
  const context = await getAdminContext(session.user.id);

  const query = searchParams?.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const { accounts, totalCount, pageSize } = await listAccounts(query, page);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("page", String(nextPage));
    return `/admin/accounts?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalCount} account{totalCount === 1 ? "" : "s"} total. Search by username, display name, or email, or
          browse everything below.
        </p>
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

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          {query ? <>No accounts match &ldquo;{query}&rdquo;.</> : "No accounts yet."}
        </div>
      ) : (
        <AccountsList accounts={accounts} canDelete={context.capabilities.has("delete_accounts")} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {page > 1 ? (
            <a href={pageHref(page - 1)} className="font-semibold text-primary hover:underline">
              &larr; Previous
            </a>
          ) : (
            <span />
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a href={pageHref(page + 1)} className="font-semibold text-primary hover:underline">
              Next &rarr;
            </a>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
