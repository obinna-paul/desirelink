"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNavItems } from "@/lib/nav-items";
import { NavCountBadge } from "@/components/layout/nav-count-badge";
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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex min-h-16 items-center justify-around border-t border-border bg-card px-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 shadow-[0_-10px_30px_rgba(35,25,15,0.08)] md:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className="flex flex-1 flex-col items-center justify-center py-1"
          >
            <span className="flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 transition-colors">
              <span className="relative">
                <Icon
                  className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")}
                  aria-hidden="true"
                  strokeWidth={2}
                />
                {item.href === "/messages" && (
                  <NavCountBadge count={unreadMessageCount} className="absolute -right-2 -top-1.5" />
                )}
              </span>
              <span
                className={cn(
                  "truncate text-[10px] font-light",
                  active ? "text-primary" : "text-muted-foreground"
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
