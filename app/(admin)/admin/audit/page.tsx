import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { formatDistanceToNow } from "date-fns";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getAuditLog } from "@/lib/admin/audit";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
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
};

export default async function AdminAuditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "view_audit_log");
  if (!gate.ok) {
    notFound();
  }

  const { items } = await getAuditLog({ take: 50 });

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every privileged action taken through the admin console. Append-only.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
          Nothing recorded yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm md:rounded-xl md:shadow-none"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{ACTION_LABELS[entry.action] ?? entry.action}</Badge>
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
      )}
    </div>
  );
}
