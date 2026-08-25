import Link from "next/link";

import { SubscriptionTierCard } from "@/components/provider/SubscriptionTierCard";
import type { PublicTierView } from "@/lib/tiers";

export function TierMenu({
  providerId,
  tiers,
  isOwner,
}: {
  providerId: string;
  tiers: PublicTierView[];
  isOwner: boolean;
}) {
  if (tiers.length === 0) {
    if (!isOwner) return null;
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
        You haven&apos;t created any tiers yet. Add one from your{" "}
        <Link href="/creator-dashboard?tab=tiers" className="text-neon-pink underline underline-offset-2">
          provider dashboard
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((tier) => (
        <SubscriptionTierCard key={tier.id} providerId={providerId} tier={tier} />
      ))}
    </div>
  );
}
