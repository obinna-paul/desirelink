import Link from "next/link";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PayoutRow = {
  id: string;
  month: string;
  label: string;
  points: number;
  amountCents: number;
  status: string;
  payoutReference?: string | null;
  paidAt?: string | null;
};

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function PayoutHistory({ providerId, payouts }: { providerId: string; payouts: PayoutRow[] }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:shadow-card">
      <h2 className="text-sm font-semibold">Payout history</h2>
      {payouts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No monthly payouts have been recorded yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[640px] border-collapse text-left text-sm md:w-full">
            <thead>
              <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Month</th>
                <th scope="col" className="py-2 pr-4 font-medium">Points</th>
                <th scope="col" className="py-2 pr-4 font-medium">Amount</th>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-4">{payout.label}</td>
                  <td className="py-2 pr-4 tabular-nums">{payout.points}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatCents(payout.amountCents)}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={payout.status === "paid" || payout.status === "credited" ? "neon" : "outline"}>
                      {payout.status}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <Link href={`/api/providers/${providerId}/payouts/${payout.id}/receipt`}>
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        Download
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
