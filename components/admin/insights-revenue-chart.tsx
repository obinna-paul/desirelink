"use client";

import { CartesianGrid, Line, LineChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCents } from "@/lib/creator";

type RevenuePoint = { label: string; subscriptions: number; services: number; hearts: number };

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export function InsightsRevenueChart({ data }: { data: RevenuePoint[] }) {
  const totalCents = Math.round(data.reduce((sum, p) => sum + p.subscriptions + p.services + p.hearts, 0) * 100);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Revenue by source</h3>
        <span className="text-sm font-semibold tabular-nums">{formatCents(totalCents)}</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} tickFormatter={(value: number) => `₦${value}`} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(value, name) => [`₦${Number(value).toFixed(2)}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="subscriptions" name="Subscriptions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="services" name="Services" stroke="hsl(var(--trust))" strokeWidth={2} strokeDasharray="5 3" dot={false} />
            <Line type="monotone" dataKey="hearts" name="Hearts" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="2 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="flex min-h-11 cursor-pointer select-none items-center">View as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left">
            <caption className="sr-only">Revenue by source and period</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-1 pr-4 font-medium">Period</th>
                <th scope="col" className="py-1 pr-4 font-medium">Subscriptions</th>
                <th scope="col" className="py-1 pr-4 font-medium">Services</th>
                <th scope="col" className="py-1 font-medium">Hearts</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.label} className="border-b border-border/40 last:border-0">
                  <td className="py-1 pr-4">{point.label}</td>
                  <td className="py-1 pr-4 tabular-nums text-foreground">₦{point.subscriptions.toFixed(2)}</td>
                  <td className="py-1 pr-4 tabular-nums text-foreground">₦{point.services.toFixed(2)}</td>
                  <td className="py-1 tabular-nums text-foreground">₦{point.hearts.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
