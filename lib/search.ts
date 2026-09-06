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
