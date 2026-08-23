import Link from "next/link";

import { cn } from "@/lib/utils";
import { HOME_TABS, type HomeTabValue } from "@/lib/home-feed";

export function HomeTabs({ activeTab }: { activeTab: HomeTabValue }) {
  return (
    <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-1.5 md:w-full md:flex-wrap">
        {HOME_TABS.map((tab) => {
          const isActive = tab.value === activeTab;
          return (
            <li key={tab.value}>
              <Link
                href={`/?tab=${tab.value}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors",
                  isActive
                    ? "border-transparent bg-gradient-to-r from-neon-pink to-neon-cyan text-background"
                    : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
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
