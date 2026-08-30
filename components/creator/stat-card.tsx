import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-4 shadow-card md:rounded-xl",
        highlight ? "border-transparent bg-foreground text-background" : "border-border bg-card"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          highlight ? "bg-background/10" : "bg-accent-tint text-primary"
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={cn("label-caps text-[10px]", highlight ? "text-background/60" : "text-muted-foreground")}>
          {label}
        </p>
        <p className="font-heading truncate text-2xl italic font-semibold md:text-xl">{value}</p>
      </div>
    </div>
  );
}
