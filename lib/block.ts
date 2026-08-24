import { prisma } from "@/lib/prisma";

export type BlockRelationship = "none" | "blocked_by_me" | "blocked_by_them";

/** True if either profile has blocked the other. Used to gate interactions symmetrically. */
export async function isBlockedEitherWay(profileIdA: string, profileIdB: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: profileIdA, blockedId: profileIdB },
        { blockerId: profileIdB, blockedId: profileIdA },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}

/** Directional relationship, for UI that needs to distinguish "I blocked them" from "they blocked me". */
export async function getBlockRelationship(
  viewerId: string,
  otherId: string
): Promise<BlockRelationship> {
  const [blockedByMe, blockedByThem] = await Promise.all([
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: viewerId, blockedId: otherId } },
    }),
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: otherId, blockedId: viewerId } },
    }),
  ]);

  if (blockedByMe) return "blocked_by_me";
  if (blockedByThem) return "blocked_by_them";
  return "none";
}

export type BlockActionResult = { ok: true } | { ok: false; status: number; error: string };

export async function blockUser(blockerId: string, blockedId: string): Promise<BlockActionResult> {
  if (blockerId === blockedId) {
    return { ok: false, status: 400, error: "You can't block yourself" };
  }

  const target = await prisma.profile.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!target) {
    return { ok: false, status: 404, error: "Profile not found" };
  }

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });

  return { ok: true };
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<BlockActionResult> {
  await prisma.block.deleteMany({ where: { blockerId, blockedId } });
  return { ok: true };
}

const blockedProfileSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export async function getBlockedProfiles(blockerId: string) {
  return prisma.block.findMany({
    where: { blockerId },
    orderBy: { createdAt: "desc" },
    include: { blocked: { select: blockedProfileSelect } },
  });
}

export type BlockedProfileData = Awaited<ReturnType<typeof getBlockedProfiles>>[number];
