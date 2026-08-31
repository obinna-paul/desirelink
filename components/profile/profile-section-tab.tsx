import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function ProfileSectionTab({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex h-12 min-w-0 items-center justify-center text-xs font-semibold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-foreground after:transition-transform md:h-12 md:min-w-max md:gap-2 md:px-5 md:after:inset-x-4",
        isActive
          ? "text-foreground after:scale-x-100"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      <span className="sr-only md:not-sr-only">{label}</span>
    </Link>
  );
}
