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
        "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
        isActive
          ? "border-transparent bg-gradient-to-r from-neon-pink to-neon-cyan text-background"
          : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}
