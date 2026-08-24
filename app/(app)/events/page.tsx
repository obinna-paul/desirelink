import Link from "next/link";
import { CalendarPlus, ListChecks } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { getUpcomingEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await getUpcomingEvents();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Events"
        description="Find and host in-person and virtual gatherings."
      />

      <div className="flex flex-wrap gap-3">
        <Button asChild className="gap-1.5">
          <Link href="/events/new">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Host an event
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/events/manage">
            <ListChecks className="h-4 w-4" aria-hidden="true" /> Manage your events
          </Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          No upcoming events yet. Be the first to host one.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
