import { Coins, PiggyBank, TrendingUp, Wallet } from "lucide-react";

import { StatCard } from "@/components/creator/stat-card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/creator";
import { METRIC_TYPE_LABELS } from "@/lib/rewards/points";
import type { ProviderEarningsHistory } from "@/lib/rewards/earnings";

type CurrentMonthEstimate = {
  poolCents: number;
  totalPoints: number;
  ownPoints: number;
  ownPointsPercent: number;
  estimatedAmountCents: number;
  pointsBreakdown: { metricType: string; points: number }[];
};

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function EarningsPanel({
  estimate,
  history,
}: {
  estimate: CurrentMonthEstimate;
  history: ProviderEarningsHistory;
}) {
  const latestPayout = history[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
        <StatCard label="Estimated earnings (this month)" value={formatCents(estimate.estimatedAmountCents)} icon={Coins} />
        <StatCard label="Current pool size" value={formatCents(estimate.poolCents)} icon={PiggyBank} />
        <StatCard label="Your share of points" value={`${estimate.ownPointsPercent.toFixed(1)}%`} icon={TrendingUp} />
        <StatCard
          label="Payout status"
          value={latestPayout ? `${latestPayout.status} (${monthLabel(latestPayout.month)})` : "No payouts yet"}
          icon={Wallet}
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-xl md:shadow-none">
        <h3 className="text-sm font-semibold">Points breakdown (this month)</h3>
        <p className="text-xs text-muted-foreground">
          {estimate.ownPoints} of {estimate.totalPoints} pool-wide points earned so far this month.
        </p>
        {estimate.pointsBreakdown.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No engagement recorded yet this month.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {estimate.pointsBreakdown.map((entry) => (
              <li key={entry.metricType} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {METRIC_TYPE_LABELS[entry.metricType as keyof typeof METRIC_TYPE_LABELS] ?? entry.metricType}
                </span>
                <Badge variant="outline">{entry.points} pts</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-xl md:shadow-none">
        <h3 className="text-sm font-semibold">Payout history</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No completed payouts yet - check back after the next monthly cycle.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-[520px] border-collapse text-left text-sm md:w-full">
              <thead>
                <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">Month</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Points</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Amount</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-4">{monthLabel(entry.month)}</td>
                    <td className="py-2 pr-4 tabular-nums">{entry.points}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatCents(entry.amountCents)}</td>
                    <td className="py-2">
                      <Badge variant={entry.status === "paid" ? "neon" : "outline"}>{entry.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
