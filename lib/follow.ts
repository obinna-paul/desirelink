import { prisma } from "@/lib/prisma";
import { isBlockedEitherWay } from "@/lib/block";

export type FollowActionResult = { ok: true } | { ok: false; status: number; error: string };

export async function followProfile(
  followerId: string,
  followingId: string,
): Promise<FollowActionResult> {
  if (followerId === followingId) {
    return { ok: false, status: 400, error: "You can't follow yourself" };
  }

  const target = await prisma.profile.findUnique({ where: { id: followingId }, select: { id: true } });
  if (!target) {
    return { ok: false, status: 404, error: "Profile not found" };
  }

  if (await isBlockedEitherWay(followerId, followingId)) {
    return { ok: false, status: 403, error: "You can't follow this profile" };
  }

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    create: { followerId, followingId },
    update: {},
  });

  return { ok: true };
}

export async function unfollowProfile(
  followerId: string,
  followingId: string,
): Promise<FollowActionResult> {
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
  return { ok: true };
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  return Boolean(follow);
}

/** Ids of every profile a viewer follows - used to build the Following feed. */
export async function getFollowingIds(followerId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({
    where: { followerId },
    select: { followingId: true },
  });
  return rows.map((row) => row.followingId);
}
