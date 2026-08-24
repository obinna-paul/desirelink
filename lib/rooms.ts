import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { flagContentIfNeeded } from "@/lib/moderation";

const memberProfileSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const roomCardInclude = {
  createdBy: { select: memberProfileSelect },
  _count: { select: { members: { where: { status: "approved" } }, posts: true } },
} satisfies Prisma.RoomInclude;

export type RoomCardData = Prisma.RoomGetPayload<{ include: typeof roomCardInclude }>;

const MAX_POST_LENGTH = 3000;

export async function getPublicRooms(limit = 60): Promise<RoomCardData[]> {
  return prisma.room.findMany({
    where: { isPrivate: false },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: roomCardInclude,
  });
}

export async function createRoom(
  creatorProfileId: string,
  data: { name: string; description: string; isPrivate: boolean; coverImageUrl: string }
) {
  return prisma.room.create({
    data: {
      ...data,
      createdById: creatorProfileId,
      members: {
        create: { userId: creatorProfileId, role: "admin", status: "approved" },
      },
    },
  });
}

export type MembershipState = "none" | "pending" | "member" | "admin";

async function getMembership(roomId: string, profileId: string | null) {
  if (!profileId) return null;
  return prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: profileId } } });
}

function membershipState(membership: { role: string; status: string } | null): MembershipState {
  if (!membership) return "none";
  if (membership.status === "pending") return "pending";
  return membership.role === "admin" ? "admin" : "member";
}

export async function getRoomDetail(roomId: string, viewerProfileId: string | null) {
  const room = await prisma.room.findUnique({ where: { id: roomId }, include: roomCardInclude });
  if (!room) return null;

  const membership = await getMembership(roomId, viewerProfileId);
  return { room, state: membershipState(membership) };
}

/** Posts and the member list are gated on private rooms — only approved members (and the admin) can see them. */
export function canViewRoomContent(room: { isPrivate: boolean }, state: MembershipState): boolean {
  if (!room.isPrivate) return true;
  return state === "member" || state === "admin";
}

export async function getRoomPosts(roomId: string, limit = 60) {
  return prisma.roomPost.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { author: { select: memberProfileSelect } },
  });
}

export type RoomPostData = Awaited<ReturnType<typeof getRoomPosts>>[number];

export async function getApprovedMembers(roomId: string) {
  return prisma.roomMember.findMany({
    where: { roomId, status: "approved" },
    orderBy: { createdAt: "asc" },
    include: { profile: { select: memberProfileSelect } },
  });
}

export async function getPendingMembers(roomId: string) {
  return prisma.roomMember.findMany({
    where: { roomId, status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { profile: { select: memberProfileSelect } },
  });
}

export type RoomMemberData = Awaited<ReturnType<typeof getApprovedMembers>>[number];

export type JoinResult =
  | { ok: true; state: "joined" | "pending" }
  | { ok: false; status: number; error: string };

/** Public rooms join immediately; private rooms create a pending request for the admin to approve. */
export async function joinRoom(roomId: string, profileId: string): Promise<JoinResult> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, isPrivate: true, createdById: true },
  });
  if (!room) {
    return { ok: false, status: 404, error: "Room not found" };
  }

  const existing = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: profileId } },
  });
  if (existing) {
    return { ok: true, state: existing.status === "pending" ? "pending" : "joined" };
  }

  const status = room.isPrivate ? "pending" : "approved";
  await prisma.roomMember.create({ data: { roomId, userId: profileId, role: "member", status } });

  return { ok: true, state: status === "pending" ? "pending" : "joined" };
}

export async function isRoomAdmin(roomId: string, requesterId: string): Promise<boolean> {
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: requesterId } },
  });
  return Boolean(membership && membership.role === "admin" && membership.status === "approved");
}

/** Anyone who can see a public room's content, or an approved/admin member of a private one. */
export async function canAccessRoomChat(roomId: string, profileId: string): Promise<boolean> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { isPrivate: true } });
  if (!room) return false;
  if (!room.isPrivate) return true;

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: profileId } },
  });
  return Boolean(membership && membership.status === "approved");
}

/** Posting requires actual (approved) membership, even in a public room — same rule as RoomPost. */
export async function canPostInRoomChat(roomId: string, profileId: string): Promise<boolean> {
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: profileId } },
  });
  return Boolean(membership && membership.status === "approved");
}

export type ModerationResult = { ok: true } | { ok: false; status: number; error: string };

export async function approveMember(
  roomId: string,
  memberId: string,
  requesterId: string
): Promise<ModerationResult> {
  if (!(await isRoomAdmin(roomId, requesterId))) {
    return { ok: false, status: 404, error: "Room not found" };
  }

  const member = await prisma.roomMember.findUnique({ where: { id: memberId } });
  if (!member || member.roomId !== roomId) {
    return { ok: false, status: 404, error: "Member not found" };
  }

  await prisma.roomMember.update({ where: { id: memberId }, data: { status: "approved" } });
  return { ok: true };
}

/** Removes an approved member, or denies a pending join request — same action either way. */
export async function removeMember(
  roomId: string,
  memberId: string,
  requesterId: string
): Promise<ModerationResult> {
  if (!(await isRoomAdmin(roomId, requesterId))) {
    return { ok: false, status: 404, error: "Room not found" };
  }

  const member = await prisma.roomMember.findUnique({ where: { id: memberId } });
  if (!member || member.roomId !== roomId) {
    return { ok: false, status: 404, error: "Member not found" };
  }
  if (member.role === "admin") {
    return { ok: false, status: 400, error: "Can't remove the room admin" };
  }

  await prisma.roomMember.delete({ where: { id: memberId } });
  return { ok: true };
}

export type CreatePostResult =
  | { ok: true; post: RoomPostData }
  | { ok: false; status: number; error: string };

export async function createRoomPost(
  roomId: string,
  authorId: string,
  content: string
): Promise<CreatePostResult> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, status: 400, error: "Post can't be empty" };
  }
  if (trimmed.length > MAX_POST_LENGTH) {
    return { ok: false, status: 400, error: `Post is too long (max ${MAX_POST_LENGTH} characters)` };
  }

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: authorId } },
  });
  if (!membership || membership.status !== "approved") {
    return { ok: false, status: 403, error: "Join this room to post" };
  }

  const author = await prisma.profile.findUnique({ where: { id: authorId }, select: { isSuspended: true } });
  if (!author || author.isSuspended) {
    return { ok: false, status: 403, error: "Your account is suspended from posting" };
  }

  const post = await prisma.roomPost.create({
    data: { roomId, authorId, content: trimmed, mediaUrls: [] },
    include: { author: { select: memberProfileSelect } },
  });
  await flagContentIfNeeded({
    contentType: "room_post",
    contentId: post.id,
    contentOwnerId: authorId,
    content: post.content,
  });

  return { ok: true, post };
}

export async function deleteRoomPost(
  roomId: string,
  postId: string,
  requesterId: string
): Promise<ModerationResult> {
  if (!(await isRoomAdmin(roomId, requesterId))) {
    return { ok: false, status: 404, error: "Room not found" };
  }

  const post = await prisma.roomPost.findUnique({ where: { id: postId } });
  if (!post || post.roomId !== roomId) {
    return { ok: false, status: 404, error: "Post not found" };
  }

  await prisma.roomPost.delete({ where: { id: postId } });
  return { ok: true };
}
