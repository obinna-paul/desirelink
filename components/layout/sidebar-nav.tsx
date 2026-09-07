"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNavItems, secondaryNavItems } from "@/lib/nav-items";
import { NavCountBadge } from "@/components/layout/nav-count-badge";
import { NavIcon } from "@/components/layout/nav-icon";
import { useUnreadMessageCount } from "@/lib/use-unread-message-count";

export function SidebarNav({
  isProvider = false,
  viewerProfileId = null,
}: {
  isProvider?: boolean;
  viewerProfileId?: string | null;
}) {
  const pathname = usePathname();
  const items = [...primaryNavItems, ...secondaryNavItems].filter(
    (item) => !item.providerOnly || isProvider
  );
  const unreadMessageCount = useUnreadMessageCount(viewerProfileId);
  const [pressedHref, setPressedHref] = useState<string | null>(null);
  const [pressCount, setPressCount] = useState<Record<string, number>>({});

  return (
    <aside
      aria-label="Primary navigation"
      className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[232px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-sidebar px-3 py-6 md:flex"
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
            aria-current={active ? "page" : undefined}
            onClick={() => {
              setPressedHref(item.href);
              setPressCount((current) => ({
                ...current,
                [item.href]: (current[item.href] ?? 0) + 1,
              }));
            }}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.985] motion-reduce:transform-none",
              active
                ? "bg-accent-tint text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <span className="relative flex shrink-0 transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none">
              <NavIcon
                key={`${item.href}:${pressCount[item.href] ?? 0}`}
                icon={item.icon}
                href={item.href}
                active={active}
                animate={active || pressedHref === item.href}
                className="h-4 w-4"
              />
              {item.href === "/messages" && (
                <NavCountBadge count={unreadMessageCount} className="absolute -right-2 -top-1.5" />
              )}
            </span>
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
