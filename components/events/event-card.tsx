import Link from "next/link";
import Image from "next/image";
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
      className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/80 hover:shadow-lift"
    >
      <div className="relative flex h-32 w-full items-center justify-center overflow-hidden bg-media-placeholder">
        {event.coverImageUrl ? (
          <Image
            src={event.coverImageUrl}
            alt=""
            fill
            sizes="(min-width: 1536px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <CalendarDays className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="absolute left-3 top-3 overflow-hidden rounded-lg bg-white text-center shadow-card">
          <div className="bg-white px-2 py-0.5 text-[9px] font-bold uppercase leading-none text-primary">
            {new Date(event.startTime).toLocaleString(undefined, { month: "short" })}
          </div>
          <div className="px-2 pb-1 text-sm font-extrabold leading-none text-background">
            {new Date(event.startTime).getDate()}
          </div>
        </div>
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
