"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNavItems } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      {primaryNavItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        if (item.href === "/create") {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-neon-pink to-neon-cyan text-background shadow-lg shadow-neon-pink/30"
            >
              <Icon className="h-7 w-7" />
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium",
              active ? "text-neon-pink" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
