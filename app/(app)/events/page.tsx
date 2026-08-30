import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CalendarPlus, ListChecks } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { Button } from "@/components/ui/button";
import { EventGrid } from "@/components/events/event-grid";
import { EventFiltersPanel } from "@/components/events/event-filters";
import { RecommendedEventsBanner } from "@/components/events/recommended-events-banner";
import {
  parseEventFilters,
  searchEvents,
  type EventSearchParams,
} from "@/lib/events";
import { getRecommendedEventsForUser } from "@/lib/event-recommendations";

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
    select: { id: true, locationLat: true, locationLng: true, profileType: true },
  });
  const isProvider = viewerProfile ? isProviderProfileType(viewerProfile.profileType) : false;

  const filters = parseEventFilters(searchParams);
  const [{ events, note }, recommendedEvents] = await Promise.all([
    searchEvents(filters, viewerProfile),
    getRecommendedEventsForUser(session.user.id, 3),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {isProvider && (
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3">
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
      )}

      <RecommendedEventsBanner recommendations={recommendedEvents ?? []} />

      <EventFiltersPanel initialFilters={filters} />

      <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        {events.length} upcoming {events.length === 1 ? "event" : "events"}
      </div>

      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      <EventGrid
        events={events}
        emptyMessage="No events match these filters yet. Try widening your search, or be the first to host one."
      />
    </div>
  );
}
