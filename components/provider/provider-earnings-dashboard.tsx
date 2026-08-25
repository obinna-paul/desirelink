"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownToLine, CircleDollarSign, PieChart as PieChartIcon, TrendingUp, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProviderEarningsDashboardData } from "@/lib/rewards/earnings";

type EarningsData = NonNullable<ProviderEarningsDashboardData>;

const SOURCE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--neon-pink))",
  "hsl(var(--neon-cyan))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--secondary-foreground))",
];

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--foreground))",
  fontSize: 12,
};

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function StatTile({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: typeof CircleDollarSign;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
          {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-neon-pink">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="h-72 w-full">{children}</div>
    </section>
  );
}

export function ProviderEarningsDashboard({
  data,
  providerId,
}: {
  data: EarningsData;
  providerId: string;
}) {
  const monthlyChart = data.monthly.map((month) => ({
    month: month.label,
    subscriptions: month.directSubscriptionsCents / 100,
    rewards: month.rewardsPoolCents / 100,
    services: month.serviceBookingsCents / 100,
    tickets: month.eventTicketsCents / 100,
    total: month.totalCents / 100,
    points: month.points,
    subscribers: month.subscriberCount,
  }));

  const pieData = data.sourceBreakdown
    .filter((source) => source.amountCents > 0)
    .map((source) => ({ name: source.label, value: source.amountCents / 100 }));
  const latestPayout = data.payoutHistory[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Earnings</h1>
          <p className="text-sm text-muted-foreground">
            Income, rewards points, payout history, and current-month estimates.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/api/providers/${providerId}/earnings/export`}>
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="This month" value={formatCents(data.totals.thisMonthCents)} icon={CircleDollarSign} />
        <StatTile label="Last month" value={formatCents(data.totals.lastMonthCents)} icon={TrendingUp} />
        <StatTile label="All time" value={formatCents(data.totals.allTimeCents)} icon={Wallet} />
        <StatTile
          label="Live estimate"
          value={formatCents(data.totals.liveEstimatedCurrentMonthCents)}
          helper="Updates with current rewards-pool position"
          icon={PieChartIcon}
        />
        <StatTile
          label="Payout status"
          value={latestPayout ? latestPayout.status : "No payouts"}
          helper={latestPayout ? latestPayout.label : "Monthly payout history will appear here"}
          icon={Wallet}
        />
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Revenue by source</h2>
            <p className="text-xs text-muted-foreground">Direct income plus live rewards estimates.</p>
          </div>
          <Badge variant={data.rewardsPool.isMonetized ? "neon" : "outline"}>
            {data.rewardsPool.isMonetized ? "monetized" : "not monetized"}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {data.sourceBreakdown.map((source) => (
            <div key={source.key} className="rounded-xl border border-border/60 bg-secondary/35 p-3">
              <p className="text-xs text-muted-foreground">{source.label}</p>
              <p className="mt-1 text-lg font-semibold">{formatCents(source.amountCents)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{source.status}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Monthly earnings" description="Last 12 months, stacked by source.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCents(Number(value) * 100)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="subscriptions" stackId="earnings" name="Subscriptions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rewards" stackId="earnings" name="Rewards" fill="hsl(var(--neon-pink))" />
              <Bar dataKey="services" stackId="earnings" name="Services" fill="hsl(var(--neon-cyan))" />
              <Bar dataKey="tickets" stackId="earnings" name="Tickets" fill="hsl(var(--muted-foreground))" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue breakdown" description="All tracked earnings by source.">
          {pieData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              No revenue has been recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCents(Number(value) * 100)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={2}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Subscriber growth" description="Cumulative direct subscribers over the last 12 months.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="subscribers" name="Subscribers" stroke="hsl(var(--neon-cyan))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Engagement points trend" description="Monthly points that feed rewards-pool eligibility.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="points" name="Points" stroke="hsl(var(--neon-pink))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold">Points breakdown</h2>
          <p className="text-xs text-muted-foreground">Current-month signals and their point weights.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">Metric</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Count</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Weight</th>
                  <th scope="col" className="py-2 font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {data.points.rows.map((row) => (
                  <tr key={row.metricType} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-4">{row.label}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.count}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.weight}</td>
                    <td className="py-2 tabular-nums">{row.points}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/60 font-semibold">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 pr-4">{data.points.activeSubscribers} active subscribers</td>
                  <td className="py-2 pr-4" />
                  <td className="py-2 tabular-nums">{data.points.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold">Rewards pool</h2>
          <p className="text-xs text-muted-foreground">
            {data.rewardsPool.month}: 70% of premium revenue is allocated to providers by points.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-border/60 bg-secondary/35 p-3">
              <dt className="text-xs text-muted-foreground">Pool size</dt>
              <dd className="mt-1 font-semibold">{formatCents(data.rewardsPool.poolCents)}</dd>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/35 p-3">
              <dt className="text-xs text-muted-foreground">Premium subscribers</dt>
              <dd className="mt-1 font-semibold">{data.rewardsPool.premiumSubscriberCount}</dd>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/35 p-3">
              <dt className="text-xs text-muted-foreground">Your share</dt>
              <dd className="mt-1 font-semibold">{data.rewardsPool.providerPercent.toFixed(1)}%</dd>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/35 p-3">
              <dt className="text-xs text-muted-foreground">Estimated payout</dt>
              <dd className="mt-1 font-semibold">{formatCents(data.rewardsPool.estimatedPayoutCents)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Points come from premium-user engagement: content views, replies, profile views, event RSVPs,
            service activity, and subscriber retention. Final payouts are created by the monthly rewards cron.
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
        <h2 className="text-sm font-semibold">Payout history</h2>
        {data.payoutHistory.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No monthly payouts have been recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">Month</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Points</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Amount</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.payoutHistory.map((payout) => (
                  <tr key={payout.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-4">{payout.label}</td>
                    <td className="py-2 pr-4 tabular-nums">{payout.points}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatCents(payout.amountCents)}</td>
                    <td className="py-2">
                      <Badge variant={payout.status === "paid" ? "neon" : "outline"}>{payout.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
