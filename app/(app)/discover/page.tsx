import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileGrid } from "@/components/home/profile-grid";
import { DiscoverFiltersPanel } from "@/components/discover/discover-filters";
import { DiscoverSearchInput } from "@/components/discover/discover-search-input";
import { SearchResults, type TopResultRow } from "@/components/search/search-results";
import { getPostsByIds } from "@/lib/posts";
import { getServiceListingsByIds } from "@/lib/service-listings";
import { logSearchInteraction, searchDocuments } from "@/lib/search";
import { getHiddenCreatorIds, getNotInterestedPostIds } from "@/lib/content-feedback";
import {
  DEFAULT_RADIUS_KM,
  parseDiscoverFilters,
  searchDiscoverProfiles,
  type DiscoverSearchParams,
} from "@/lib/discover";

function reorder<T>(items: T[], rankedIds: string[], idOf: (item: T) => string): T[] {
  const byId = new Map(items.map((item) => [idOf(item), item]));
  return rankedIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

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

  const searchRows = filters.query ? await searchDocuments(filters.query) : [];
  if (filters.query) {
    await logSearchInteraction(viewerProfile?.id ?? null, filters.query, searchRows.length);
  }

  const postIds = searchRows.filter((row) => row.entityType === "post").map((row) => row.entityId);
  const serviceIds = searchRows
    .filter((row) => row.entityType === "service_listing")
    .map((row) => row.entityId);
  const hashtags = searchRows
    .filter((row) => row.entityType === "hashtag")
    .map((row) => row.title);

  const [rawPosts, rawServices, hiddenCreatorIds, notInterestedPostIds, blocks] = filters.query
    ? await Promise.all([
        getPostsByIds(postIds, viewerProfile?.id ?? null),
        getServiceListingsByIds(serviceIds),
        viewerProfile ? getHiddenCreatorIds(viewerProfile.id) : Promise.resolve([]),
        viewerProfile ? getNotInterestedPostIds(viewerProfile.id) : Promise.resolve([]),
        viewerProfile
          ? prisma.block.findMany({
              where: {
                OR: [{ blockerId: viewerProfile.id }, { blockedId: viewerProfile.id }],
              },
              select: { blockerId: true, blockedId: true },
            })
          : Promise.resolve([]),
      ])
    : [[], [], [], [], []];

  const blockedProfileIds = new Set(
    blocks.map((block) =>
      block.blockerId === viewerProfile?.id ? block.blockedId : block.blockerId,
    ),
  );
  const hiddenCreatorIdSet = new Set(hiddenCreatorIds);
  const notInterestedPostIdSet = new Set(notInterestedPostIds);
  const posts = reorder(
    rawPosts.filter(
      (post) =>
        !hiddenCreatorIdSet.has(post.author.id) &&
        !blockedProfileIds.has(post.author.id) &&
        !notInterestedPostIdSet.has(post.id),
    ),
    postIds,
    (post) => post.id,
  );
  const services = reorder(
    rawServices.filter((service) => !blockedProfileIds.has(service.provider.id)),
    serviceIds,
    (service) => service.id,
  );

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const postById = new Map(posts.map((post) => [post.id, post]));
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const top: TopResultRow[] = searchRows.flatMap((row) => {
    if (row.entityType === "profile") {
      const profile = profileById.get(row.entityId);
      return profile
        ? [{ key: `profile-${row.entityId}`, href: `/profile/${profile.username}`, title: profile.displayName || profile.username, subtitle: "Person" }]
        : [];
    }
    if (row.entityType === "post") {
      const post = postById.get(row.entityId);
      return post
        ? [{ key: `post-${row.entityId}`, href: `/posts/${row.entityId}`, title: post.content?.slice(0, 80) || row.title, subtitle: "Post" }]
        : [];
    }
    if (row.entityType === "hashtag") {
      return [{ key: `hashtag-${row.entityId}`, href: `/hashtag/${encodeURIComponent(row.title)}`, title: `#${row.title}`, subtitle: "Hashtag" }];
    }
    if (row.entityType === "service_listing") {
      const service = serviceById.get(row.entityId);
      return service
        ? [{ key: `service-${row.entityId}`, href: `/services/${row.entityId}`, title: service.title, subtitle: "Service" }]
        : [];
    }
    return [];
  }).slice(0, 20);

  const activeFilterCount =
    (filters.query ? 1 : 0) +
    filters.genders.length +
    filters.orientations.length +
    (filters.radiusKm !== DEFAULT_RADIUS_KM ? 1 : 0) +
    (filters.availability !== "any" ? 1 : 0) +
    (filters.sort !== "recommended" ? 1 : 0) +
    (filters.lastActive !== "any" ? 1 : 0) +
    (filters.verification !== "any" ? 1 : 0);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <DiscoverSearchInput initialQuery={filters.query} />
        <DiscoverFiltersPanel initialFilters={filters} />
      </div>

      {filters.query ? (
        <SearchResults
          query={filters.query}
          top={top}
          profiles={profiles}
          posts={posts}
          hashtags={hashtags}
          services={services}
          viewerProfileId={viewerProfile?.id ?? null}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{profiles.length}</span>{" "}
              {profiles.length === 1 ? "profile matches" : "profiles match"} your filters
              {activeFilterCount > 0 && ` (${activeFilterCount} applied)`}
            </p>
          </div>

          {note && <p className="text-sm text-muted-foreground">{note}</p>}

          <ProfileGrid
            profiles={profiles}
            emptyMessage="No one matches these filters yet. Try widening your search."
          />
        </>
      )}
    </div>
  );
}
