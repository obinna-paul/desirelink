"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNavItems } from "@/lib/nav-items";

export function BottomNav({ isProvider = false }: { isProvider?: boolean }) {
  const pathname = usePathname();
  const items = primaryNavItems.filter((item) => !item.providerOnly || isProvider);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex min-h-16 items-center justify-around border-t border-border bg-card px-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 shadow-[0_-10px_30px_rgba(35,25,15,0.08)] md:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        const isCreate = item.href === "/create";

        if (isCreate) {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className="flex flex-1 flex-col items-center justify-center"
            >
              <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              "label-caps flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[9px] transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.5 : 2} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
