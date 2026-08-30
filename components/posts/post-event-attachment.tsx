import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RsvpButtons } from "@/components/events/rsvp-buttons";
import type { PostEventView } from "@/lib/posts";

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(cents / 100);
}

export function PostEventAttachment({ event }: { event: PostEventView }) {
  const location = [event.venueName, event.city].filter(Boolean).join(", ");
  const isFull = event.maxAttendees !== null && event.currentAttendees >= event.maxAttendees;

  return (
    <section className="rounded-2xl border border-border/60 bg-background/55 p-3 md:rounded-lg">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{event.eventType}</Badge>
        <Badge variant={event.priceCents > 0 ? "secondary" : "neon"}>
          {event.priceCents > 0 ? formatCents(event.priceCents) : "Free"}
        </Badge>
        {isFull && <Badge variant="outline">Full</Badge>}
      </div>

      <div className="mt-3">
        <Link href={`/events/${event.id}`} className="font-heading text-lg font-semibold leading-tight hover:text-primary">
          {event.title}
        </Link>
        <div className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-neon-pink" aria-hidden="true" />
            {new Date(event.startTime).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          {location && (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-neon-pink" aria-hidden="true" />
              {location}
            </span>
          )}
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-neon-pink" aria-hidden="true" />
            {event.currentAttendees} going
            {event.maxAttendees ? ` / ${event.maxAttendees}` : ""}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <RsvpButtons
          eventId={event.id}
          initialStatus={event.viewerRsvpStatus}
          isPriced={event.priceCents > 0}
        />
      </div>

      <Button asChild variant="outline" size="sm" className="mt-3 w-full">
        <Link href={`/events/${event.id}`}>View event</Link>
      </Button>
    </section>
  );
}
