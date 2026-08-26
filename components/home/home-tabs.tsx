import Link from "next/link";

import { cn } from "@/lib/utils";
import { HOME_TABS, type HomeTabValue } from "@/lib/home-feed";

export function HomeTabs({ activeTab }: { activeTab: HomeTabValue }) {
  return (
    <nav className="-mx-3 overflow-x-auto px-3 md:mx-0 md:border-b md:border-border/60 md:px-0">
      <ul className="flex w-max gap-2 md:w-full md:flex-wrap md:gap-6">
        {HOME_TABS.map((tab) => {
          const isActive = tab.value === activeTab;
          return (
            <li key={tab.value}>
              <Link
                href={`/?tab=${tab.value}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors md:h-11 md:rounded-none md:border-x-0 md:border-t-0 md:border-b-2 md:px-2.5",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground md:bg-transparent md:text-foreground"
                    : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground md:border-transparent md:bg-transparent"
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
