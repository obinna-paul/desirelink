import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { BriefcaseBusiness, CalendarClock } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { Button } from "@/components/ui/button";
import { ServiceListingGrid } from "@/components/home/service-listing-grid";
import { ServiceFiltersPanel } from "@/components/services/service-filters";
import {
  parseServiceFilters,
  searchServiceListings,
  type ServiceSearchParams,
} from "@/lib/service-listings";

export const dynamic = "force-dynamic";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: ServiceSearchParams;
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
  const listServiceHref = isProvider ? "/services/new" : "/settings/account-type?intent=service";

  const filters = parseServiceFilters(searchParams);
  const { listings, note } = await searchServiceListings(filters, viewerProfile);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="gap-1.5">
          <Link href={listServiceHref}>
            <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" /> List a service
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/services/bookings">
            <CalendarClock className="h-4 w-4" aria-hidden="true" /> My bookings
          </Link>
        </Button>
      </div>

      <ServiceFiltersPanel initialFilters={filters} />

      <div className="px-0.5 text-sm text-muted-foreground">
        {listings.length} {listings.length === 1 ? "service" : "services"} found
      </div>

      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      <ServiceListingGrid
        listings={listings}
        emptyMessage="No services match these filters yet. Try widening your search, or be the first to list one."
        viewerProfileId={viewerProfile?.id ?? null}
      />
    </div>
  );
}
