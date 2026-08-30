import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileGrid } from "@/components/home/profile-grid";
import { DiscoverFiltersPanel } from "@/components/discover/discover-filters";
import { DiscoverTabs } from "@/components/discover/discover-tabs";
import { EventGrid } from "@/components/events/event-grid";
import { ServiceListingGrid } from "@/components/home/service-listing-grid";
import { DEFAULT_DISCOVER_SECTION, isDiscoverSectionValue } from "@/lib/discover-sections";
import {
  DEFAULT_RADIUS_KM,
  hasAdvancedDiscoverFilters,
  parseDiscoverFilters,
  searchDiscoverProfiles,
  type DiscoverSearchParams,
} from "@/lib/discover";
import { isPremiumUser } from "@/lib/premium";
import { getHomeUpcomingEvents } from "@/lib/events";
import { getHomeServiceListings } from "@/lib/service-listings";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: DiscoverSearchParams & { section?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, locationLat: true, locationLng: true },
  });

  const section = isDiscoverSectionValue(searchParams.section) ? searchParams.section : DEFAULT_DISCOVER_SECTION;

  if (section === "events") {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <DiscoverHeader />
        <DiscoverTabs activeSection={section} />
        <EventGrid
          events={await getHomeUpcomingEvents(viewerProfile, 24)}
          emptyMessage="No upcoming events yet. Head to Events to host one."
        />
      </div>
    );
  }

  if (section === "services") {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <DiscoverHeader />
        <DiscoverTabs activeSection={section} />
        <ServiceListingGrid
          listings={await getHomeServiceListings(24)}
          emptyMessage="No services are listed yet. Create a service when you are ready to offer one."
        />
      </div>
    );
  }

  const filters = parseDiscoverFilters(searchParams);
  const viewerIsPremium = viewerProfile ? await isPremiumUser(viewerProfile.id) : false;
  const { profiles, note } = await searchDiscoverProfiles(filters, viewerProfile, viewerIsPremium);

  const activeFilterCount =
    (filters.query ? 1 : 0) +
    filters.genders.length +
    filters.orientations.length +
    (filters.radiusKm !== DEFAULT_RADIUS_KM ? 1 : 0) +
    (filters.availability !== "any" ? 1 : 0) +
    (filters.sort !== "newest" ? 1 : 0) +
    (viewerIsPremium && hasAdvancedDiscoverFilters(filters)
      ? filters.accountTypes.length +
        filters.desireCategories.length +
        (filters.desireLevel ? 1 : 0) +
        filters.bodyTypes.length +
        (filters.lastActive !== "any" ? 1 : 0) +
        (filters.verification !== "any" ? 1 : 0)
      : 0);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <DiscoverHeader />
      <DiscoverTabs activeSection={section} />

      <DiscoverFiltersPanel initialFilters={filters} isPremium={viewerIsPremium} />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{profiles.length}</span>{" "}
          {profiles.length === 1 ? "profile matches" : "profiles match"} {filters.query ? "your search" : "your filters"}
          {activeFilterCount > 0 && ` (${activeFilterCount} applied)`}
        </p>
      </div>

      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      <ProfileGrid
        profiles={profiles}
        emptyMessage="No one matches these filters yet. Try widening your search."
      />
    </div>
  );
}

function DiscoverHeader() {
  return (
    <>
      <div className="hidden md:block">
        <PageHeader
          title="Discover"
          description="Search udala with basic filters, browse events, or find a service."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find people, events, and services nearby.</p>
      </div>
    </>
  );
}
