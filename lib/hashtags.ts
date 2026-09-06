import { prisma } from "@/lib/prisma";
import { upsertSearchDocument } from "@/lib/search";

const HASHTAG_PATTERN = new RegExp("#([\\p{L}\\p{M}\\p{N}_]{1,50})", "gu");

/** Caps how many distinct hashtags get indexed per post - a lightweight defense against
 * tag stuffing. Extra tags past this are silently dropped, not an error. */
export const MAX_HASHTAGS_PER_POST = 10;

export function normalizeHashtag(raw: string): string {
  return raw.trim().replace(/^#/, "").normalize("NFKC").toLowerCase();
}

/** Extracts up to MAX_HASHTAGS_PER_POST unique hashtags from a caption, in first-seen order. */
export function extractHashtags(content: string): string[] {
  const seen = new Set<string>();
  for (const match of Array.from(content.matchAll(HASHTAG_PATTERN))) {
    if (seen.size >= MAX_HASHTAGS_PER_POST) break;
    const tag = normalizeHashtag(match[1]);
    if (tag.length > 0) seen.add(tag);
  }
  return Array.from(seen);
}

/**
 * Re-derives a post's hashtag associations from its current caption - called on both create
 * and edit, since editing a caption can add or remove tags. Deletes and recreates rather than
 * diffing: the per-post tag count is capped at MAX_HASHTAGS_PER_POST, so this is cheap.
 */
export async function syncPostHashtags(postId: string, content: string): Promise<void> {
  const tags = extractHashtags(content);

  await prisma.postHashtag.deleteMany({ where: { postId } });
  if (tags.length === 0) return;

  const hashtags = await Promise.all(
    tags.map((tag) => prisma.hashtag.upsert({ where: { tag }, create: { tag }, update: {} })),
  );

  await prisma.postHashtag.createMany({
    data: hashtags.map((hashtag) => ({ postId, hashtagId: hashtag.id })),
    skipDuplicates: true,
  });

  await Promise.all(
    hashtags.map((hashtag) =>
      upsertSearchDocument({
        entityType: "hashtag",
        entityId: hashtag.id,
        title: hashtag.tag,
        body: hashtag.tag,
      }),
    ),
  );
}
