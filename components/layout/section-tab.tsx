import Link from "next/link";

import { cn } from "@/lib/utils";

export function SectionTab({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors md:h-11 md:rounded-none md:border-x-0 md:border-t-0 md:border-b-2 md:px-2",
        isActive
          ? "border-primary bg-primary text-primary-foreground md:bg-transparent md:text-foreground"
          : "border-border/60 bg-card text-muted-foreground hover:text-foreground md:border-transparent md:bg-transparent"
      )}
    >
      {label}
    </Link>
  );
}
