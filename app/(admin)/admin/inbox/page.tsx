import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { formatDistanceToNow } from "date-fns";

import { authOptions } from "@/lib/auth";
import { getAdminContext } from "@/lib/admin/access";
import { getAuditLog, type AdminAuditAction } from "@/lib/admin/audit";
import { getPendingVerificationRequests } from "@/lib/verification";
import { getModerationQueue } from "@/lib/moderation";
import { getPendingWithdrawals } from "@/lib/wallet";
import { VerificationQueue } from "@/components/admin/verification-queue";
import { ModerationQueue } from "@/components/admin/moderation-queue";
import { WithdrawalsQueue } from "@/components/admin/withdrawals-queue";
import { InboxTabs } from "@/components/admin/inbox-tabs";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const DECISION_ACTIONS: AdminAuditAction[] = [
  "verification.approve",
  "verification.deny",
  "moderation.review",
  "moderation.remove",
  "moderation.warn",
  "moderation.suspend",
  "withdrawal.approve",
];

export default async function AdminInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const context = await getAdminContext(session.user.id);
  if (!context.isAdmin) {
    notFound();
  }

  const canReviewVerification = context.capabilities.has("view_verification_media");
  const canModerate = context.capabilities.has("moderate_content");
  const canManagePayouts = context.capabilities.has("manage_payouts");

  if (!canReviewVerification && !canModerate && !canManagePayouts) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
        Nothing queued for your role yet.
      </div>
    );
  }

  const [verifications, moderationFlags, withdrawals, history] = await Promise.all([
    canReviewVerification ? getPendingVerificationRequests() : Promise.resolve(null),
    canModerate ? getModerationQueue("pending") : Promise.resolve(null),
    canManagePayouts ? getPendingWithdrawals() : Promise.resolve(null),
    getAuditLog({ take: 30 }),
  ]);

  const counts = {
    verification: verifications?.length ?? 0,
    moderation: moderationFlags?.length ?? 0,
    withdrawal: withdrawals?.length ?? 0,
  };
  const total = counts.verification + counts.moderation + counts.withdrawal;

  const historyItems = history.items.filter((entry) => DECISION_ACTIONS.includes(entry.action as AdminAuditAction));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total === 0 ? "Nothing waiting." : `${total} item${total === 1 ? "" : "s"} waiting across verification, reports, and payouts.`}
        </p>
      </div>

      <InboxTabs
        counts={counts}
        verificationSection={verifications ? <VerificationQueue initialRequests={verifications} /> : null}
        moderationSection={moderationFlags ? <ModerationQueue initialItems={moderationFlags} /> : null}
        withdrawalSection={withdrawals ? <WithdrawalsQueue initialWithdrawals={withdrawals} /> : null}
        historySection={
          historyItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {historyItems.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border/60 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{entry.action}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-1 text-foreground">{entry.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">by {entry.actor.name}</p>
                </li>
              ))}
            </ul>
          )
        }
      />
    </div>
  );
}
