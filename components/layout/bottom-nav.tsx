"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNavItems } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[72px] items-center justify-around border-t border-border/60 bg-background/96 px-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 shadow-[0_-10px_30px_rgba(15,10,18,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/86 md:hidden">
      {primaryNavItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-semibold transition-colors",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
