import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Download } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getAuditLog, type AdminAuditAction } from "@/lib/admin/audit";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<AdminAuditAction, string> = {
  "verification.approve": "Approved verification",
  "verification.deny": "Denied verification",
  "verification.view_media": "Viewed verification media",
  "moderation.review": "Reviewed content",
  "moderation.remove": "Removed content",
  "moderation.warn": "Warned user",
  "moderation.suspend": "Suspended user",
  "withdrawal.approve": "Approved payout",
  "content.view_locked": "Opened locked content",
  "account.suspend": "Suspended account",
  "account.reinstate": "Reinstated account",
  "account.note": "Added account note",
  "finance.release_escrow": "Released escrow",
  "finance.refund_escrow": "Refunded escrow",
  "admin.role_change": "Changed admin role",
};

const ACTIONS = Object.keys(ACTION_LABELS) as AdminAuditAction[];

function isAdminAuditAction(value: string | undefined): value is AdminAuditAction {
  return Boolean(value) && (ACTIONS as string[]).includes(value!);
}

export default async function AdminAuditPage({ searchParams }: { searchParams?: { action?: string; cursor?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "view_audit_log");
  if (!gate.ok) {
    notFound();
  }

  const actionFilter = isAdminAuditAction(searchParams?.action) ? searchParams!.action : undefined;
  const { items, nextCursor } = await getAuditLog({ take: 50, action: actionFilter, cursor: searchParams?.cursor });

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every privileged action taken through the admin console. Append-only.</p>
        </div>
        <a
          href={`/api/admin/audit/export.csv${actionFilter ? `?action=${actionFilter}` : ""}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input px-3 text-xs font-medium hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export CSV
        </a>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <select
          name="action"
          defaultValue={actionFilter ?? ""}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-primary/60"
        >
          <option value="">All actions</option>
          {ACTIONS.map((action) => (
            <option key={action} value={action}>
              {ACTION_LABELS[action]}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg border border-input px-3 text-sm font-medium hover:bg-accent">
          Filter
        </button>
        {actionFilter && (
          <Link href="/admin/audit" className="text-xs text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
          Nothing recorded yet.
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm md:rounded-xl md:shadow-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{ACTION_LABELS[entry.action as AdminAuditAction] ?? entry.action}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {entry.actor.name} ({entry.actor.email})
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground" title={new Date(entry.createdAt).toISOString()}>
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-foreground">{entry.summary}</p>
              </li>
            ))}
          </ul>

          {nextCursor && (
            <Link
              href={`/admin/audit?${actionFilter ? `action=${actionFilter}&` : ""}cursor=${nextCursor}`}
              className="self-center text-sm font-medium text-primary hover:underline"
            >
              Load more
            </Link>
          )}
        </>
      )}
    </div>
  );
}
