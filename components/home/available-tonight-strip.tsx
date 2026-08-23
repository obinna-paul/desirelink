import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AvailabilityFeedItem } from "@/lib/availability";

export function AvailableTonightStrip({ items }: { items: AvailabilityFeedItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full bg-neon-cyan shadow-[0_0_8px_hsl(var(--neon-cyan))] motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Available Tonight
        </h2>
      </div>
      <div className="-mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/profile/${item.username}`}
                className="flex w-20 flex-col items-center gap-1.5 text-center"
              >
                <div className="relative">
                  <Avatar className="h-14 w-14 border-2 border-neon-cyan/70">
                    <AvatarImage src={item.avatarUrl} alt={item.displayName} />
                    <AvatarFallback>{item.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span
                    className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-neon-cyan motion-safe:animate-pulse"
                    aria-hidden="true"
                  />
                </div>
                <p className="w-full truncate text-xs text-muted-foreground">{item.displayName}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
