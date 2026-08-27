"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Pencil, Trash2, Users } from "lucide-react";
import type { Event } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";

export function EventManageList({ initialEvents }: { initialEvents: Event[] }) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this event? This can't be undone.")) return;

    setDeletingId(id);
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    setDeletingId(null);

    if (res.ok) {
      setEvents((prev) => prev.filter((event) => event.id !== id));
      router.refresh();
    }
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
        You haven&apos;t hosted any events yet.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((event) => {
        const isPast = new Date(event.endTime) < new Date();
        const location = [event.venueName, event.city].filter(Boolean).join(", ");

        return (
          <li
            key={event.id}
            className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between md:rounded-lg md:p-4 md:shadow-none"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold md:text-sm">{event.title}</p>
                <Badge variant="outline">{event.eventType}</Badge>
                {event.isPrivate && <Badge variant="secondary">Private</Badge>}
                {isPast && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Past
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                  {new Date(event.startTime).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                {location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden="true" /> {location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {event.currentAttendees}
                  {event.maxAttendees ? ` / ${event.maxAttendees}` : ""}
                </span>
                {event.priceCents > 0 && <span>{formatCents(event.priceCents)}</span>}
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href={`/events/manage/${event.id}/edit`}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive"
                disabled={deletingId === event.id}
                onClick={() => handleDelete(event.id)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {deletingId === event.id ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
