import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileGrid } from "@/components/home/profile-grid";
import { DiscoverFiltersPanel } from "@/components/discover/discover-filters";
import {
  DEFAULT_RADIUS_KM,
  parseDiscoverFilters,
  searchDiscoverProfiles,
  type DiscoverSearchParams,
} from "@/lib/discover";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: DiscoverSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, locationLat: true, locationLng: true },
  });

  const filters = parseDiscoverFilters(searchParams);
  const { profiles, note } = await searchDiscoverProfiles(filters, viewerProfile);

  const activeFilterCount =
    (filters.query ? 1 : 0) +
    filters.genders.length +
    filters.orientations.length +
    (filters.radiusKm !== DEFAULT_RADIUS_KM ? 1 : 0) +
    (filters.availability !== "any" ? 1 : 0) +
    (filters.sort !== "newest" ? 1 : 0) +
    filters.accountTypes.length +
    filters.bodyTypes.length +
    (filters.lastActive !== "any" ? 1 : 0) +
    (filters.verification !== "any" ? 1 : 0);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <DiscoverFiltersPanel initialFilters={filters} />

      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
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
