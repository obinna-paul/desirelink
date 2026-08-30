import Link from "next/link";

import { cn } from "@/lib/utils";
import { DISCOVER_SECTIONS, type DiscoverSectionValue } from "@/lib/discover-sections";

export function DiscoverTabs({ activeSection }: { activeSection: DiscoverSectionValue }) {
  return (
    <nav aria-label="Discover sections" className="rounded-2xl border border-border/60 bg-card p-1 shadow-sm md:max-w-xl md:rounded-xl">
      <ul className="grid grid-cols-3 gap-1">
        {DISCOVER_SECTIONS.map((section) => {
          const isActive = section.value === activeSection;
          return (
            <li key={section.value}>
              <Link
                href={section.value === "people" ? "/discover" : `/discover?section=${section.value}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
