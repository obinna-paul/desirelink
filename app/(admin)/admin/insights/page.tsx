import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import {
  getRevenueTrend,
  getGrowthSummary,
  getAccountMilestones,
  getDiscoveryGuardrails,
  INSIGHTS_RANGES,
  type InsightsRange,
} from "@/lib/admin/metrics";
import { InsightsRevenueChart } from "@/components/admin/insights-revenue-chart";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGE_LABELS: Record<InsightsRange, string> = { "7d": "7d", "30d": "30d", "90d": "90d", "12mo": "12mo" };

function Tile({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{hint}</p>
    </div>
  );
}

function MilestoneRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percentage = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[11rem_minmax(0,1fr)_7rem]">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        className="col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:col-span-1"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${value === 0 ? 0 : Math.max(2, Math.min(100, percentage))}%` }}
        />
      </div>
      <div className="row-start-1 text-right text-sm tabular-nums sm:row-auto">
        {value.toLocaleString()} <span className="text-muted-foreground">({percentage}%)</span>
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

  const [revenue, growth, milestones, guardrails] = await Promise.all([
    getRevenueTrend(range),
    getGrowthSummary(range),
    getAccountMilestones(),
    getDiscoveryGuardrails(range),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">Account activity and successful customer payments over time.</p>
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
        <Tile label="Completed signups" value={growth.signups} hint="Profiles created in this period" />
        <Tile label="Publishing profiles" value={growth.publishingProfiles} hint="Unique people who created content" />
        <Tile label="Active profiles" value={growth.activeUsers} hint="Seen in the app during this period" />
        <Tile label="Unique payers" value={growth.payingUsers} hint="People with a successful charge" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold">Account milestones</h2>
          <p className="text-xs text-muted-foreground">
            Independent all-time milestones, each shown as a share of completed profiles. They are not sequential steps.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 pt-1">
          <MilestoneRow label="Profiles created" value={milestones.totalProfiles} total={milestones.totalProfiles} />
          <MilestoneRow label="Published anything" value={milestones.publishingProfiles} total={milestones.totalProfiles} />
          <MilestoneRow label="Published a post" value={milestones.profilesWithPosts} total={milestones.totalProfiles} />
          <MilestoneRow label="Listed a service" value={milestones.profilesWithServices} total={milestones.totalProfiles} />
          <MilestoneRow label="Earned funds" value={milestones.earningProfiles} total={milestones.totalProfiles} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold">Discovery guardrails</h2>
          <p className="text-xs text-muted-foreground">
            Watched alongside growth, not optimized for directly - see the discovery/ranking plan.
            Repeat-content only reflects impressions still within the ~45-day retention window,
            regardless of the range selected above.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            label="New-creator reach"
            value={`${guardrails.newCreatorReachPct}%`}
            hint="Impression share to creators new this period"
          />
          <Tile
            label="Repeat-content rate"
            value={`${guardrails.repeatContentRatePct}%`}
            hint="Impressions on an already-seen creator"
          />
          <Tile
            label="Creator-reach Gini"
            value={guardrails.creatorReachGini}
            hint="0 = evenly spread, 1 = concentrated"
          />
          <Tile
            label="Top 1% creator share"
            value={`${guardrails.top1PercentCreatorImpressionSharePct}%`}
            hint="Impression share held by the top 1% of creators"
          />
          <Tile
            label="Report rate"
            value={guardrails.reportRatePer1000Impressions}
            hint="Post reports per 1,000 impressions"
          />
        </div>
      </div>
    </div>
  );
}
