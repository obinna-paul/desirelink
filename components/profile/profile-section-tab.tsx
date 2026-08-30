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
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "label-caps inline-flex h-11 min-w-max items-center justify-center gap-1.5 rounded-full px-4 text-[11px] transition-colors md:h-12 md:rounded-none md:border-b-2 md:px-3",
        isActive
          ? "bg-primary text-primary-foreground md:border-primary md:bg-transparent md:text-primary"
          : "bg-card text-muted-foreground hover:bg-accent-tint hover:text-primary md:border-transparent md:bg-transparent"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
