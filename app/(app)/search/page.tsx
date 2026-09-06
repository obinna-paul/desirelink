import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileCardSelect, type ProfileCardData } from "@/lib/home-feed";
import { getPostsByIds, type PostView } from "@/lib/posts";
import { getServiceListingsByIds, type HomeServiceListingView } from "@/lib/service-listings";
import { searchDocuments, logSearchInteraction } from "@/lib/search";
import { SearchResults, type TopResultRow } from "@/components/search/search-results";

const TOP_RESULTS_LIMIT = 20;

function reorder<T>(items: T[], rankedIds: string[], idOf: (item: T) => string): T[] {
  const byId = new Map(items.map((item) => [idOf(item), item]));
  return rankedIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await getServerSession(authOptions);
  const viewerProfile = session?.user?.id
    ? await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    : null;
  const viewerProfileId = viewerProfile?.id ?? null;

  const query = (searchParams.q ?? "").trim();
  const rows = query ? await searchDocuments(query) : [];

  if (query) {
    await logSearchInteraction(viewerProfileId, query, rows.length);
  }

  const profileIds = rows.filter((row) => row.entityType === "profile").map((row) => row.entityId);
  const postIds = rows.filter((row) => row.entityType === "post").map((row) => row.entityId);
  const hashtagTitles = rows.filter((row) => row.entityType === "hashtag").map((row) => row.title);
  const serviceListingIds = rows
    .filter((row) => row.entityType === "service_listing")
    .map((row) => row.entityId);

  const [profileRows, postViews, serviceListings] = await Promise.all([
    profileIds.length > 0
      ? prisma.profile.findMany({ where: { id: { in: profileIds } }, select: profileCardSelect() })
      : Promise.resolve([]),
    getPostsByIds(postIds, viewerProfileId),
    getServiceListingsByIds(serviceListingIds),
  ]);

  const profiles = reorder(profileRows, profileIds, (p) => p.id) as ProfileCardData[];
  const posts = reorder(postViews, postIds, (p) => p.id) as PostView[];
  const services = reorder(serviceListings, serviceListingIds, (s) => s.id) as HomeServiceListingView[];

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const postById = new Map(posts.map((post) => [post.id, post]));
  const serviceById = new Map(services.map((service) => [service.id, service]));

  const top: TopResultRow[] = rows.slice(0, TOP_RESULTS_LIMIT).flatMap((row) => {
    if (row.entityType === "profile") {
      const profile = profileById.get(row.entityId);
      if (!profile) return [];
      return [
        {
          key: `profile-${row.entityId}`,
          href: `/profile/${profile.username}`,
          title: profile.displayName || profile.username,
          subtitle: "Person",
        },
      ];
    }
    if (row.entityType === "post") {
      const post = postById.get(row.entityId);
      if (!post) return [];
      return [
        {
          key: `post-${row.entityId}`,
          href: `/posts/${row.entityId}`,
          title: post.content?.slice(0, 80) || row.title,
          subtitle: "Post",
        },
      ];
    }
    if (row.entityType === "hashtag") {
      return [
        {
          key: `hashtag-${row.entityId}`,
          href: `/hashtag/${row.title}`,
          title: `#${row.title}`,
          subtitle: "Hashtag",
        },
      ];
    }
    if (row.entityType === "service_listing") {
      const service = serviceById.get(row.entityId);
      if (!service) return [];
      return [
        {
          key: `service-${row.entityId}`,
          href: `/services/${row.entityId}`,
          title: service.title,
          subtitle: "Service",
        },
      ];
    }
    return [];
  });

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <SearchResults
        query={query}
        top={top}
        profiles={profiles}
        posts={posts}
        hashtags={hashtagTitles}
        services={services}
        viewerProfileId={viewerProfileId}
      />
    </div>
  );
}
