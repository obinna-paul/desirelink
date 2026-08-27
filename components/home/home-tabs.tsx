import Link from "next/link";

import { cn } from "@/lib/utils";
import { HOME_TABS, type HomeTabValue } from "@/lib/home-feed";

export function HomeTabs({ activeTab }: { activeTab: HomeTabValue }) {
  return (
    <nav aria-label="Home sections" className="rounded-2xl border border-border/60 bg-card p-1 shadow-sm md:max-w-xl md:rounded-xl">
      <ul className="grid grid-cols-3 gap-1">
        {HOME_TABS.map((tab) => {
          const isActive = tab.value === activeTab;
          return (
            <li key={tab.value}>
              <Link
                href={tab.value === "feed" ? "/" : `/?tab=${tab.value}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
