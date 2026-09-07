"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNavItems } from "@/lib/nav-items";
import { NavCountBadge } from "@/components/layout/nav-count-badge";
import { NavIcon } from "@/components/layout/nav-icon";
import { useUnreadMessageCount } from "@/lib/use-unread-message-count";

export function BottomNav({
  isProvider = false,
  viewerProfileId = null,
}: {
  isProvider?: boolean;
  viewerProfileId?: string | null;
}) {
  const pathname = usePathname();
  const items = primaryNavItems.filter((item) => !item.providerOnly || isProvider);
  const unreadMessageCount = useUnreadMessageCount(viewerProfileId);
  const [pressedHref, setPressedHref] = useState<string | null>(null);
  const [pressCount, setPressCount] = useState<Record<string, number>>({});

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex min-h-16 items-center justify-around border-t border-border bg-card px-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 shadow-[0_-10px_30px_rgba(35,25,15,0.08)] md:hidden"
    >
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              setPressedHref(item.href);
              setPressCount((current) => ({
                ...current,
                [item.href]: (current[item.href] ?? 0) + 1,
              }));
            }}
            className="group flex min-h-12 flex-1 flex-col items-center justify-center py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex flex-col items-center gap-0.5 px-2 py-1 transition-transform duration-150 ease-out group-active:scale-[0.96] motion-reduce:transform-none">
              <span
                className={cn(
                  "relative flex h-8 w-10 items-center justify-center rounded-full transition-[background-color,color] duration-200",
                  active ? "bg-accent-tint" : "bg-transparent",
                )}
              >
                <NavIcon
                  key={`${item.href}:${pressCount[item.href] ?? 0}`}
                  icon={item.icon}
                  href={item.href}
                  active={active}
                  animate={active || pressedHref === item.href}
                  className="h-5 w-5"
                />
                {item.href === "/messages" && (
                  <NavCountBadge count={unreadMessageCount} className="absolute -right-2 -top-1.5" />
                )}
              </span>
              <span
                className={cn(
                  "truncate text-[10px] leading-3 transition-colors duration-200",
                  active ? "font-semibold text-primary" : "font-normal text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
