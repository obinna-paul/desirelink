import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin, Users, Video } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
      className="group flex flex-col overflow-hidden rounded-lg border border-border/70 bg-card transition-[transform,border-color,box-shadow] hover:border-foreground/20 hover:shadow-lift md:hover:-translate-y-0.5"
    >
      <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden bg-secondary">
        {event.coverImageUrl ? (
          <Image
            src={event.coverImageUrl}
            alt=""
            fill
            sizes="(min-width: 1536px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <CalendarDays className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="absolute left-3 top-3 overflow-hidden rounded-md bg-white text-center shadow-card">
          <div className="px-2 pt-1 text-[9px] font-bold uppercase leading-none text-primary">
            {new Date(event.startTime).toLocaleString(undefined, { month: "short" })}
          </div>
          <div className="px-2 pb-1.5 pt-0.5 text-sm font-extrabold leading-none text-black">
            {new Date(event.startTime).getDate()}
          </div>
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {typeof matchScore === "number" && (
            <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
              {matchScore}% match
            </span>
          )}
          <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
            {event.priceCents > 0 ? formatCents(event.priceCents) : "Free"}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3.5 md:p-4">
        <p className="text-[11px] font-semibold uppercase text-primary">{event.eventType}</p>
        <p className="line-clamp-2 text-base font-semibold leading-5">{event.title}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" aria-hidden="true" />
          {new Date(event.startTime).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        {event.format !== "in_person" && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Video className="h-3 w-3 shrink-0" aria-hidden="true" />
            {event.format === "hybrid" ? "In person + online" : "Online event"}
          </p>
        )}
        {location && event.format !== "online" && (
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
