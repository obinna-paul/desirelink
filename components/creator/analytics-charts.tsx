"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type GrowthPoint = { month: string; subscribers: number };
type EarningsPoint = { month: string; earnings: number };
type RewardsPoint = { month: string; amount: number };

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

function ChartCard({
  title,
  description,
  children,
  tableCaption,
  rows,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  tableCaption: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="h-64 w-full">{children}</div>
      <details className="text-xs text-muted-foreground">
        <summary className="flex min-h-11 cursor-pointer select-none items-center">View as table</summary>
        <table className="mt-2 w-full border-collapse text-left">
          <caption className="sr-only">{tableCaption}</caption>
          <thead>
            <tr className="border-b border-border/60">
              <th scope="col" className="py-1 pr-4 font-medium">
                Month
              </th>
              <th scope="col" className="py-1 font-medium">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border/40 last:border-0">
                <td className="py-1 pr-4">{row.label}</td>
                <td className="py-1 tabular-nums text-foreground">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function SubscriberGrowthChart({ data }: { data: GrowthPoint[] }) {
  return (
    <ChartCard
      title="Fan growth"
      description="Cumulative Fans over the last 6 months"
      tableCaption="Cumulative Fan count by month"
      rows={data.map((point) => ({ label: point.month, value: String(point.subscribers) }))}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
          <YAxis
            allowDecimals={false}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            formatter={(value) => [value, "Fans"]}
          />
          <Line
            type="monotone"
            dataKey="subscribers"
            stroke="hsl(var(--neon-cyan))"
            strokeWidth={2}
            dot={{ r: 4, fill: "hsl(var(--neon-cyan))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "hsl(var(--card))", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function EarningsChart({ data }: { data: EarningsPoint[] }) {
  return (
    <ChartCard
      title="Earnings"
      description="Revenue collected per month (NGN)"
      tableCaption="Earnings in NGN by month"
      rows={data.map((point) => ({
        label: point.month,
        value: `₦${point.earnings.toFixed(2)}`,
      }))}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(value: number) => `₦${value}`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(value) => [`₦${Number(value).toFixed(2)}`, "Earnings"]}
          />
          <Bar dataKey="earnings" fill="hsl(var(--neon-pink))" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function RewardsEarningsChart({ data }: { data: RewardsPoint[] }) {
  return (
    <ChartCard
      title="Rewards pool payouts"
      description="Your share of the monthly provider rewards pool"
      tableCaption="Rewards pool payout in NGN by month"
      rows={data.map((point) => ({
        label: point.month,
        value: `₦${point.amount.toFixed(2)}`,
      }))}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(value: number) => `₦${value}`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(value) => [`₦${Number(value).toFixed(2)}`, "Payout"]}
          />
          <Bar dataKey="amount" fill="hsl(var(--neon-cyan))" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
