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
    <nav className="-mx-3 overflow-x-auto px-3 md:mx-0 md:border-b md:border-border md:px-0">
      <ul className="flex w-max gap-2 md:w-full md:flex-wrap md:gap-6">
        {tabs.map((tab) => {
          const isActive = tab.value === activeTab;
          return (
            <li key={tab.value}>
              <Link
                href={`/creator-dashboard?tab=${tab.value}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "label-caps inline-flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-[11px] transition-colors md:h-11 md:rounded-none md:border-x-0 md:border-t-0 md:border-b-2 md:px-2",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground md:bg-transparent md:text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground md:border-transparent md:bg-transparent"
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
