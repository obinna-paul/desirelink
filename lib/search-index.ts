import { prisma } from "@/lib/prisma";

const PROFILE_BODY_MAX = 500;
const POST_BODY_MAX = 500;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export type RefreshSearchIndexSummary = {
  profiles: number;
  posts: number;
  hashtags: number;
  serviceListings: number;
};

/**
 * Rebuilds SearchDocument wholesale from the current state of every searchable table.
 * Deliberately not kept live on every write - see app/api/cron/refresh-search-index. Runs
 * in one transaction so search never serves a half-rebuilt index.
 *
 * Subscriber-only posts are excluded on purpose: a locked post's caption shouldn't leak
 * into search results for someone who hasn't unlocked it, the same reason its content is
 * blanked out elsewhere (see toPostView in lib/posts.ts).
 */
export async function refreshSearchIndex(): Promise<RefreshSearchIndexSummary> {
  const [profiles, posts, hashtags, serviceListings] = await Promise.all([
    prisma.profile.findMany({
      where: { isIncognito: false, showInSearch: true, isSuspended: false },
      select: { id: true, username: true, displayName: true, bio: true, profileViews: true },
    }),
    prisma.post.findMany({
      where: {
        isArchived: false,
        isSubscriberOnly: false,
        author: { isIncognito: false, isSuspended: false },
      },
      select: { id: true, content: true, viewCount: true },
    }),
    prisma.hashtag.findMany({
      where: {
        posts: {
          some: {
            post: {
              isArchived: false,
              isSubscriberOnly: false,
              author: { isIncognito: false, isSuspended: false },
            },
          },
        },
      },
      select: { id: true, tag: true, _count: { select: { posts: true } } },
    }),
    prisma.serviceListing.findMany({
      where: { isActive: true, provider: { isIncognito: false, isSuspended: false } },
      select: { id: true, title: true, description: true, _count: { select: { bookings: true } } },
    }),
  ]);

  await prisma.$transaction([
    prisma.searchDocument.deleteMany({}),
    prisma.searchDocument.createMany({
      data: [
        ...profiles.map((profile) => ({
          entityType: "profile",
          entityId: profile.id,
          title: profile.displayName || profile.username,
          body: truncate(`${profile.username} ${profile.bio}`, PROFILE_BODY_MAX),
          popularity: profile.profileViews,
        })),
        ...posts.map((post) => ({
          entityType: "post",
          entityId: post.id,
          title: truncate(post.content, 140),
          body: truncate(post.content, POST_BODY_MAX),
          popularity: post.viewCount,
        })),
        ...hashtags.map((hashtag) => ({
          entityType: "hashtag",
          entityId: hashtag.id,
          title: hashtag.tag,
          body: hashtag.tag,
          popularity: hashtag._count.posts,
        })),
        ...serviceListings.map((listing) => ({
          entityType: "service_listing",
          entityId: listing.id,
          title: listing.title,
          body: truncate(listing.description, 500),
          popularity: listing._count.bookings,
        })),
      ],
    }),
  ]);

  return {
    profiles: profiles.length,
    posts: posts.length,
    hashtags: hashtags.length,
    serviceListings: serviceListings.length,
  };
}
