import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { getAdminContext } from "@/lib/admin/access";
import { getOverviewSnapshot, getQueueCounts } from "@/lib/admin/metrics";
import { formatCents } from "@/lib/creator";

export const dynamic = "force-dynamic";

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const context = await getAdminContext(session.user.id);
  if (!context.isAdmin) {
    notFound();
  }

  const [queueCounts, snapshot] = await Promise.all([getQueueCounts(), getOverviewSnapshot()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">A bird&apos;s-eye read on the platform.</p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs attention</h2>
          <Link href="/admin/inbox" className="text-xs font-medium text-primary hover:underline">
            Open inbox &rarr;
          </Link>
        </div>
        {queueCounts.total === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
            Inbox is clear.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Verification" value={queueCounts.verification} />
            <Tile label="Reports" value={queueCounts.moderation} />
            <Tile label="Payouts" value={queueCounts.withdrawal} />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last 24 hours</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Signups" value={snapshot.signups24h} />
          <Tile label="New creators" value={snapshot.newCreators24h} />
          <Tile label="Revenue" value={formatCents(snapshot.revenue24hCents)} />
          <Tile label="Hearts purchased" value={snapshot.heartsPurchased24h.toLocaleString()} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Platform health</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile
            label="Payout success rate (30d)"
            value={snapshot.payoutSuccessRate === null ? "—" : `${snapshot.payoutSuccessRate}%`}
          />
          <Tile label="Failed charges (7d)" value={snapshot.failedCharges7d} />
          <Tile label="Suspensions (7d)" value={snapshot.suspensions7d} />
        </div>
      </section>
    </div>
  );
}
