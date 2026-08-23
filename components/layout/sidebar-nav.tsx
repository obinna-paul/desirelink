"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNavItems, secondaryNavItems } from "@/lib/nav-items";

export function SidebarNav() {
  const pathname = usePathname();
  const items = [...primaryNavItems, ...secondaryNavItems];

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border/60 px-3 py-6 md:flex">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-neon-pink")} />
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
