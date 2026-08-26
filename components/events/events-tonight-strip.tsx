import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";

import type { UpcomingEvent } from "@/lib/events";

export function EventsTonightStrip({ events }: { events: UpcomingEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full bg-neon-pink shadow-[0_0_8px_hsl(var(--neon-pink))] motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <h2 className="text-sm font-semibold text-foreground md:uppercase md:tracking-wide md:text-muted-foreground">
          Tonight
        </h2>
      </div>
      <div className="-mx-3 overflow-x-auto px-3 md:-mx-4 md:px-4">
        <ul className="flex w-max gap-3">
          {events.map((event) => {
            const location = [event.venueName, event.city].filter(Boolean).join(", ");
            return (
              <li key={event.id} className="w-56 shrink-0">
                <Link
                  href={`/events/${event.id}`}
                  className="flex h-full flex-col gap-1.5 rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition-colors hover:border-neon-pink/60 md:rounded-lg md:shadow-none"
                >
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {new Date(event.startTime).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  {location && (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" /> {location}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
