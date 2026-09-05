"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNavItems, secondaryNavItems } from "@/lib/nav-items";
import { NavCountBadge } from "@/components/layout/nav-count-badge";
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

  return (
    <aside
      aria-label="Primary navigation"
      className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[232px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-sidebar px-3 py-6 md:flex"
    >
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "bg-accent-tint text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <span className="relative flex shrink-0">
              <Icon
                className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")}
                aria-hidden="true"
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
