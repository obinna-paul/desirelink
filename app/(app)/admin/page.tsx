import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getPendingVerificationRequests } from "@/lib/verification";
import { getPendingWithdrawals } from "@/lib/wallet";
import { VerificationQueue } from "@/components/admin/verification-queue";
import { WithdrawalsQueue } from "@/components/admin/withdrawals-queue";
import { Button } from "@/components/ui/button";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!(await isAdminUser(session.user.id))) {
    notFound();
  }

  const [requests, withdrawals] = await Promise.all([
    getPendingVerificationRequests(),
    getPendingWithdrawals(),
  ]);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/admin/moderation">Open moderation queue</Link>
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Verification requests</h2>
        <VerificationQueue initialRequests={requests} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Withdrawal requests</h2>
        <WithdrawalsQueue initialWithdrawals={withdrawals} />
      </section>
    </div>
  );
}
