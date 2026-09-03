import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getHeldEscrowBookings, getPayoutHistory, getTransactionLedger, getHeartsEconomySummary } from "@/lib/admin/finance";
import { FinanceView } from "@/components/admin/finance-view";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "manage_payouts");
  if (!gate.ok) {
    notFound();
  }

  const [escrowBookings, payoutHistory, transactions, hearts] = await Promise.all([
    getHeldEscrowBookings(),
    getPayoutHistory(50),
    getTransactionLedger(50),
    getHeartsEconomySummary(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Escrow disputes, payouts, the transaction ledger, and the hearts economy.</p>
        </div>
        <a
          href="/api/admin/finance/transactions/export.csv"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input px-3 text-xs font-medium hover:bg-accent"
        >
          Export transactions CSV
        </a>
      </div>

      <FinanceView
        escrow={escrowBookings.map((b) => ({
          id: b.id,
          priceCents: b.priceCents,
          createdAt: b.createdAt.toISOString(),
          listingTitle: b.listing.title,
          provider: b.provider,
          customer: b.customer,
        }))}
        payoutHistory={payoutHistory.map((w) => ({
          id: w.id,
          netAmountCents: w.netAmountCents,
          status: w.status,
          createdAt: w.createdAt.toISOString(),
          paidAt: w.paidAt?.toISOString() ?? null,
          provider: w.provider,
        }))}
        transactions={transactions.map((t) => ({
          id: t.id,
          amountCents: t.amountCents,
          status: t.status,
          provider: t.provider,
          escrowStatus: t.escrowStatus,
          createdAt: t.createdAt.toISOString(),
          profile: t.profile,
        }))}
        hearts={hearts}
      />
    </div>
  );
}
