import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CalendarPlus, ListChecks } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EventGrid } from "@/components/events/event-grid";
import { EventFiltersPanel } from "@/components/events/event-filters";
import {
  parseEventFilters,
  searchEvents,
  type EventSearchParams,
} from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: EventSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, locationLat: true, locationLng: true },
  });

  const filters = parseEventFilters(searchParams);
  const { events, note } = await searchEvents(filters, viewerProfile);

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

      <EventFiltersPanel initialFilters={filters} />

      <p className="text-sm text-muted-foreground">
        {events.length} upcoming {events.length === 1 ? "event" : "events"}
      </p>

      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      <EventGrid
        events={events}
        emptyMessage="No events match these filters yet. Try widening your search, or be the first to host one."
      />
    </div>
  );
}
