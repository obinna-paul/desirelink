import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getRevenueTrend, getGrowthSummary, getActivationFunnel, INSIGHTS_RANGES, type InsightsRange } from "@/lib/admin/metrics";
import { InsightsRevenueChart } from "@/components/admin/insights-revenue-chart";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGE_LABELS: Record<InsightsRange, string> = { "7d": "7d", "30d": "30d", "90d": "90d", "12mo": "12mo" };

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FunnelRow({ label, value, of, percentOfTotal }: { label: string; value: number; of: number; percentOfTotal: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0 text-sm text-muted-foreground">{label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, percentOfTotal)}%` }} />
      </div>
      <div className="w-28 shrink-0 text-right text-sm tabular-nums">
        {value.toLocaleString()} <span className="text-muted-foreground">({of ? Math.round((value / of) * 100) : 0}%)</span>
      </div>
    </div>
  );
}

export default async function AdminInsightsPage({ searchParams }: { searchParams?: { range?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "view_audit_log");
  if (!gate.ok) {
    notFound();
  }

  const range: InsightsRange = INSIGHTS_RANGES.includes(searchParams?.range as InsightsRange)
    ? (searchParams!.range as InsightsRange)
    : "30d";

  const [revenue, growth, funnel] = await Promise.all([getRevenueTrend(range), getGrowthSummary(range), getActivationFunnel()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">Growth, revenue, and the creator economy over time.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {INSIGHTS_RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/insights?range=${r}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {RANGE_LABELS[r]}
            </Link>
          ))}
        </div>
      </div>

      <InsightsRevenueChart data={revenue} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Signups" value={growth.signups} />
        <Tile label="New creators" value={growth.newCreators} />
        <Tile label="Active users" value={growth.activeUsers} />
        <Tile label="Paying users" value={growth.payingUsers} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold">Creator activation funnel</h2>
          <p className="text-xs text-muted-foreground">
            All-time, not scoped to the selected range. &ldquo;Ever earned&rdquo; reflects current wallet balance, so it understates
            creators who&apos;ve since withdrawn everything.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 pt-1">
          <FunnelRow label="Signed up" value={funnel.totalSignups} of={funnel.totalSignups} percentOfTotal={100} />
          <FunnelRow
            label="Switched to Creator"
            value={funnel.switchedToCreator}
            of={funnel.totalSignups}
            percentOfTotal={funnel.totalSignups ? (funnel.switchedToCreator / funnel.totalSignups) * 100 : 0}
          />
          <FunnelRow
            label="Published a post"
            value={funnel.postedAsCreator}
            of={funnel.totalSignups}
            percentOfTotal={funnel.totalSignups ? (funnel.postedAsCreator / funnel.totalSignups) * 100 : 0}
          />
          <FunnelRow
            label="Ever earned"
            value={funnel.everEarned}
            of={funnel.totalSignups}
            percentOfTotal={funnel.totalSignups ? (funnel.everEarned / funnel.totalSignups) * 100 : 0}
          />
        </div>
      </div>
    </div>
  );
}
