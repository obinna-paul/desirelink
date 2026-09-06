import { prisma } from "@/lib/prisma";

export type SavedPostActionResult = { ok: true } | { ok: false; status: number; error: string };

export async function savePost(viewerId: string, postId: string): Promise<SavedPostActionResult> {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) {
    return { ok: false, status: 404, error: "Post not found" };
  }

  await prisma.savedPost.upsert({
    where: { viewerId_postId: { viewerId, postId } },
    create: { viewerId, postId },
    update: {},
  });

  return { ok: true };
}

export async function unsavePost(viewerId: string, postId: string): Promise<SavedPostActionResult> {
  await prisma.savedPost.deleteMany({ where: { viewerId, postId } });
  return { ok: true };
}

/** Saved post ids, newest-saved first - the /saved page's data source, in the order it
 * should display them (getPostsByIds in lib/posts.ts returns rows unordered). */
export async function getSavedPostIds(viewerId: string): Promise<string[]> {
  const rows = await prisma.savedPost.findMany({
    where: { viewerId },
    select: { postId: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => row.postId);
}
