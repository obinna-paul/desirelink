"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNavItems } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[70px] items-center justify-around border-t border-border/60 bg-sidebar/95 pb-1 backdrop-blur supports-[backdrop-filter]:bg-sidebar/85 md:hidden">
      {primaryNavItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        if (item.href === "/create") {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lift"
            >
              <Icon className="h-7 w-7" aria-hidden="true" />
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold",
              active ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-primary")} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
