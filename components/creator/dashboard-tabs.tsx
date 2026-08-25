import Link from "next/link";

import { cn } from "@/lib/utils";
import { CREATOR_DASHBOARD_TABS, type CreatorDashboardTab } from "@/lib/creator";

export function DashboardTabs({
  activeTab,
  tabs = CREATOR_DASHBOARD_TABS,
}: {
  activeTab: CreatorDashboardTab;
  tabs?: readonly { value: CreatorDashboardTab; label: string }[];
}) {
  return (
    <nav className="-mx-4 overflow-x-auto border-b border-border/60 px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-6 md:w-full md:flex-wrap">
        {tabs.map((tab) => {
          const isActive = tab.value === activeTab;
          return (
            <li key={tab.value}>
              <Link
                href={`/creator-dashboard?tab=${tab.value}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center whitespace-nowrap border-b-2 px-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
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
