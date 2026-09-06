import { formatCents } from "@/lib/creator";
import { getTierDiscountPercent } from "@/lib/tier-pricing";
import { cn } from "@/lib/utils";

export function TierPrice({
  priceCents,
  compareAtPriceCents,
  className,
  currentClassName,
}: {
  priceCents: number;
  compareAtPriceCents?: number | null;
  className?: string;
  currentClassName?: string;
}) {
  const discountPercent = getTierDiscountPercent(priceCents, compareAtPriceCents);

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      {discountPercent !== null && (
        <span
          className="text-xs font-medium text-muted-foreground line-through decoration-1"
          aria-label={`Original price ${formatCents(compareAtPriceCents!)}`}
        >
          {formatCents(compareAtPriceCents!)}
        </span>
      )}
      <span className={cn("text-sm font-semibold text-primary", currentClassName)}>
        {formatCents(priceCents)}/mo
      </span>
      {discountPercent !== null && (
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          {discountPercent}% off
        </span>
      )}
    </span>
  );
}
