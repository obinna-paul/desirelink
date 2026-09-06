import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const SEARCH_ENTITY_TYPES = ["profile", "post", "hashtag", "service_listing"] as const;
export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export type SearchDocumentInput = {
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  body: string;
  popularity?: number;
};

/** Writes the plain columns only - searchVector is a Postgres-generated column derived
 * from title/body (see this model's introducing migration) and can't be set directly. */
export async function upsertSearchDocument(input: SearchDocumentInput): Promise<void> {
  const { entityType, entityId, title, body, popularity = 0 } = input;
  await prisma.searchDocument.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, title, body, popularity },
    update: { title, body, popularity },
  });
}

export async function deleteSearchDocument(entityType: SearchEntityType, entityId: string): Promise<void> {
  await prisma.searchDocument.deleteMany({ where: { entityType, entityId } });
}

/** Keeps newly published or edited free posts searchable immediately. The periodic full
 * rebuild remains the repair path for missed writes and deleted orphan documents. */
export async function syncPostSearchDocument(post: {
  id: string;
  content: string;
  isSubscriberOnly: boolean;
  isArchived: boolean;
  viewCount: number;
}): Promise<void> {
  if (post.isSubscriberOnly || post.isArchived) {
    await deleteSearchDocument("post", post.id);
    return;
  }

  await upsertSearchDocument({
    entityType: "post",
    entityId: post.id,
    title: post.content.slice(0, 140),
    body: post.content.slice(0, 500),
    popularity: post.viewCount,
  });
}

export async function syncProfileSearchDocument(profile: {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  profileViews: number;
  isIncognito: boolean;
  showInSearch: boolean;
  isSuspended: boolean;
}): Promise<void> {
  if (profile.isIncognito || !profile.showInSearch || profile.isSuspended) {
    await deleteSearchDocument("profile", profile.id);
    return;
  }

  await upsertSearchDocument({
    entityType: "profile",
    entityId: profile.id,
    title: profile.displayName || profile.username,
    body: `${profile.username} ${profile.bio}`.slice(0, 500),
    popularity: profile.profileViews,
  });
}

export async function syncServiceSearchDocument(listing: {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  bookingCount?: number;
}): Promise<void> {
  if (!listing.isActive) {
    await deleteSearchDocument("service_listing", listing.id);
    return;
  }

  await upsertSearchDocument({
    entityType: "service_listing",
    entityId: listing.id,
    title: listing.title,
    body: listing.description.slice(0, 500),
    popularity: listing.bookingCount ?? 0,
  });
}

export type SearchResultRow = {
  entityType: string;
  entityId: string;
  title: string;
  rank: number;
};

const SEARCH_RESULT_LIMIT = 60;

/**
 * The codebase's first $queryRaw - Prisma can't express tsvector ranking or trigram
 * similarity natively. Hybrid ranking: full-text match via ts_rank (handles prefix/word
 * matches through websearch_to_tsquery), plus trigram similarity on the title so a typo
 * still surfaces a result. Combining the two, rather than only falling back to trigram
 * when full-text finds nothing, lets a close-but-imperfect match still outrank a weak
 * exact one.
 */
export async function searchDocuments(
  query: string,
  entityTypes?: SearchEntityType[],
): Promise<SearchResultRow[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const typeFilter =
    entityTypes && entityTypes.length > 0
      ? Prisma.sql`AND "entityType" IN (${Prisma.join(entityTypes)})`
      : Prisma.empty;

  return prisma.$queryRaw<SearchResultRow[]>(Prisma.sql`
    SELECT "entityType", "entityId", "title",
      (ts_rank("searchVector", websearch_to_tsquery('simple', immutable_unaccent(${trimmed})))
       + similarity("title", ${trimmed}) * 0.5) AS rank
    FROM "SearchDocument"
    WHERE (
      "searchVector" @@ websearch_to_tsquery('simple', immutable_unaccent(${trimmed}))
      OR similarity("title", ${trimmed}) > 0.2
    )
    ${typeFilter}
    ORDER BY rank DESC, "popularity" DESC
    LIMIT ${SEARCH_RESULT_LIMIT}
  `);
}

/** Fire-and-forget - a logging failure must never break a search request. Includes
 * zero-result queries on purpose: that's the dataset showing what people want and can't find. */
export async function logSearchInteraction(
  viewerId: string | null,
  query: string,
  resultCount: number,
): Promise<void> {
  try {
    await prisma.searchInteraction.create({ data: { viewerId, query, resultCount } });
  } catch (error) {
    console.warn("[search] failed to log search interaction", error);
  }
}
