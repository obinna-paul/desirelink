import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/creator";
import type { UpcomingEvent } from "@/lib/events";

export function EventCard({
  event,
  matchScore,
}: {
  event: UpcomingEvent;
  matchScore?: number;
}) {
  const location = [event.venueName, event.city].filter(Boolean).join(", ");
  const hostInitials = event.host.displayName.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-colors hover:border-neon-pink/60"
    >
      <div className="flex h-32 w-full items-center justify-center overflow-hidden bg-secondary">
        {event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <CalendarDays className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{event.eventType}</Badge>
          {typeof matchScore === "number" && (
            <Badge variant="neon">{matchScore}% match</Badge>
          )}
          {event.priceCents > 0 ? (
            <Badge variant="secondary">{formatCents(event.priceCents)}</Badge>
          ) : (
            <Badge variant="secondary">Free</Badge>
          )}
        </div>
        <p className="truncate text-sm font-semibold">{event.title}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" aria-hidden="true" />
          {new Date(event.startTime).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        {location && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" /> {location}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5 border border-border">
              <AvatarImage src={event.host.avatarUrl} alt={event.host.displayName} />
              <AvatarFallback className="text-[9px]">{hostInitials}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">{event.host.displayName}</span>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" aria-hidden="true" />
            {event.currentAttendees}
            {event.maxAttendees ? `/${event.maxAttendees}` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
