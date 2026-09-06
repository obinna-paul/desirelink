import { PostFeedbackKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ContentFeedbackActionResult = { ok: true } | { ok: false; status: number; error: string };

/** "Interested" / "Not interested" from the post menu - a soft signal, logged for future
 * ranking input. Never suppresses the post itself. */
export async function recordPostFeedback(
  viewerId: string,
  postId: string,
  kind: PostFeedbackKind,
): Promise<ContentFeedbackActionResult> {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) {
    return { ok: false, status: 404, error: "Post not found" };
  }

  await prisma.postFeedback.upsert({
    where: { viewerId_postId_kind: { viewerId, postId, kind } },
    create: { viewerId, postId, kind },
    update: {},
  });

  return { ok: true };
}

/** "Hide posts from this creator" - a hard mute distinct from Block. Suppresses that
 * creator's posts from the viewer's feeds; nothing else about the relationship changes. */
export async function hideCreator(viewerId: string, creatorId: string): Promise<ContentFeedbackActionResult> {
  if (viewerId === creatorId) {
    return { ok: false, status: 400, error: "You can't hide yourself" };
  }

  const creator = await prisma.profile.findUnique({ where: { id: creatorId }, select: { id: true } });
  if (!creator) {
    return { ok: false, status: 404, error: "Profile not found" };
  }

  await prisma.hiddenCreator.upsert({
    where: { viewerId_creatorId: { viewerId, creatorId } },
    create: { viewerId, creatorId },
    update: {},
  });

  return { ok: true };
}

export async function unhideCreator(viewerId: string, creatorId: string): Promise<ContentFeedbackActionResult> {
  await prisma.hiddenCreator.deleteMany({ where: { viewerId, creatorId } });
  return { ok: true };
}

/** Ids of every creator a viewer has muted - used to exclude their posts from feed queries. */
export async function getHiddenCreatorIds(viewerId: string): Promise<string[]> {
  const rows = await prisma.hiddenCreator.findMany({
    where: { viewerId },
    select: { creatorId: true },
  });
  return rows.map((row) => row.creatorId);
}
