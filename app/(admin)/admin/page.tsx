import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getAdminContext } from "@/lib/admin/access";
import { getPendingVerificationRequests } from "@/lib/verification";
import { getPendingWithdrawals } from "@/lib/wallet";
import { VerificationQueue } from "@/components/admin/verification-queue";
import { WithdrawalsQueue } from "@/components/admin/withdrawals-queue";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Already gated as an admin by app/(admin)/admin/layout.tsx - this resolves which
  // sections this specific role can see.
  const context = await getAdminContext(session.user.id);
  const canReviewVerification = context.capabilities.has("view_verification_media");
  const canManagePayouts = context.capabilities.has("manage_payouts");

  const [requests, withdrawals] = await Promise.all([
    canReviewVerification ? getPendingVerificationRequests() : Promise.resolve([]),
    canManagePayouts ? getPendingWithdrawals() : Promise.resolve([]),
  ]);

  if (!canReviewVerification && !canManagePayouts) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
        Nothing queued for your role yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {canReviewVerification && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Verification requests</h2>
          <VerificationQueue initialRequests={requests} />
        </section>
      )}

      {canManagePayouts && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Withdrawal requests</h2>
          <WithdrawalsQueue initialWithdrawals={withdrawals} />
        </section>
      )}
    </div>
  );
}
