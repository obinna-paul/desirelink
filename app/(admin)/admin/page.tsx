import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { getAdminContext } from "@/lib/admin/access";
import { getOverviewSnapshot, getQueueCounts } from "@/lib/admin/metrics";
import { formatCents } from "@/lib/creator";

export const dynamic = "force-dynamic";

function Tile({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const content = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </>
  );

  return href ? (
    <Link
      href={href}
      className="rounded-xl border border-border/60 bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  ) : (
    <div className="rounded-xl border border-border/60 bg-card p-3.5">{content}</div>
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

  const queueScope = {
    verification: context.capabilities.has("view_verification_media"),
    moderation: context.capabilities.has("moderate_content"),
    withdrawal: context.capabilities.has("manage_payouts"),
    support: context.capabilities.has("manage_support_tickets"),
  };
  const [queueCounts, snapshot] = await Promise.all([getQueueCounts(queueScope), getOverviewSnapshot()]);
  const queueTiles = [
    queueScope.verification
      ? { label: "ID checks", value: queueCounts.verification, href: "/admin/inbox" }
      : null,
    queueScope.moderation
      ? { label: "Content reports", value: queueCounts.moderation, href: "/admin/inbox" }
      : null,
    queueScope.withdrawal
      ? { label: "Payout requests", value: queueCounts.withdrawal, href: "/admin/inbox" }
      : null,
    queueScope.support
      ? { label: "Support tickets", value: queueCounts.support, href: "/admin/support" }
      : null,
  ].filter((item): item is { label: string; value: number; href: string } => item !== null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">A bird&apos;s-eye read on the platform.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs attention</h2>
        {queueCounts.total === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
            Your assigned queues are clear.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {queueTiles.map((tile) => (
              <Tile key={tile.label} {...tile} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last 24 hours</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Completed signups" value={snapshot.signups24h} hint="Profiles successfully created" />
          <Tile label="Publishing profiles" value={snapshot.publishingProfiles24h} hint="Unique people who created content" />
          <Tile label="Gross payments" value={formatCents(snapshot.grossPayments24hCents)} hint="Successful customer charges" />
          <Tile label="Hearts purchased" value={snapshot.heartsPurchased24h.toLocaleString()} hint="Successful top-ups" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Platform health</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile
            label="Settled payout success (30d)"
            value={snapshot.payoutSuccessRate === null ? "—" : `${snapshot.payoutSuccessRate}%`}
            hint="Paid ÷ paid and failed requests opened in 30d"
          />
          <Tile label="Failed charges (7d)" value={snapshot.failedCharges7d} hint="Recorded payment failures" />
          <Tile label="New suspensions (7d)" value={snapshot.suspensions7d} hint="Accounts suspended in the period" />
        </div>
      </section>
    </div>
  );
}
