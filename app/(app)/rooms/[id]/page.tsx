import nextDynamic from "next/dynamic";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Lock, Users2 } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { SectionTab } from "@/components/layout/section-tab";
import { JoinButton } from "@/components/rooms/join-button";
import { RoomPostList } from "@/components/rooms/room-post-list";
import { RoomMembersPanel } from "@/components/rooms/room-members-panel";
import { canViewRoomContent, getApprovedMembers, getPendingMembers, getRoomDetail, getRoomPosts } from "@/lib/rooms";
import { getGroupMessages, getMutedUserIds } from "@/lib/group-chat";

export const dynamic = "force-dynamic";

type RoomSection = "posts" | "members" | "chat";

const GroupChat = nextDynamic(() =>
  import("@/components/chat/group-chat").then((mod) => mod.GroupChat)
);

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { section?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!viewerProfile) {
    redirect("/login");
  }

  const detail = await getRoomDetail(params.id, viewerProfile.id);
  if (!detail) {
    notFound();
  }

  const { room, state } = detail;
  const canView = canViewRoomContent(room, state);
  const isAdmin = state === "admin";
  const canPost = state === "member" || state === "admin";
  const section: RoomSection =
    searchParams.section === "members" ? "members" : searchParams.section === "chat" ? "chat" : "posts";

  const [posts, members, pendingMembers, chatMessages, mutedUserIds] = canView
    ? await Promise.all([
        getRoomPosts(room.id),
        getApprovedMembers(room.id),
        isAdmin ? getPendingMembers(room.id) : Promise.resolve([]),
        getGroupMessages("room", room.id),
        getMutedUserIds("room", room.id),
      ])
    : [[], [], [], [], []];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title={room.name} description={room.isPrivate ? "Private room" : "Public room"} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:rounded-xl md:shadow-none">
        <div className="relative flex h-44 w-full items-center justify-center overflow-hidden bg-secondary md:h-40">
          {room.coverImageUrl ? (
            <Image
              src={room.coverImageUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 56rem, 100vw"
              className="object-cover"
            />
          ) : (
            <Users2 className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div className="md:hidden">
            <h1 className="font-heading text-2xl font-semibold leading-tight text-foreground">
              {room.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {room.isPrivate ? "Private room" : "Public room"}
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {room.isPrivate ? (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" aria-hidden="true" /> Private
                </Badge>
              ) : (
                <Badge variant="outline">Public</Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <Users2 className="h-3 w-3" aria-hidden="true" /> {room._count.members} members
              </Badge>
            </div>
            <JoinButton roomId={room.id} initialState={state} isPrivate={room.isPrivate} />
          </div>

          {room.description && <p className="text-sm text-muted-foreground">{room.description}</p>}

          <p className="text-xs text-muted-foreground">
            Created by <span className="font-medium text-foreground">{room.createdBy.displayName}</span>
          </p>
        </div>
      </div>

      {canView ? (
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <SectionTab href={`/rooms/${room.id}`} label="Posts" isActive={section === "posts"} />
            <SectionTab
              href={`/rooms/${room.id}?section=members`}
              label="Members"
              isActive={section === "members"}
            />
            <SectionTab href={`/rooms/${room.id}?section=chat`} label="Chat" isActive={section === "chat"} />
          </div>

          {section === "posts" && (
            <RoomPostList roomId={room.id} initialPosts={posts} canPost={canPost} canModerate={isAdmin} />
          )}

          {section === "members" && (
            <RoomMembersPanel
              roomId={room.id}
              initialMembers={members}
              initialPending={pendingMembers}
              isAdmin={isAdmin}
            />
          )}

          {section === "chat" && (
            <GroupChat
              channelType="room"
              channelId={room.id}
              viewerProfileId={viewerProfile.id}
              initialMessages={chatMessages}
              canPost={canPost}
              isAdmin={isAdmin}
              initiallyMuted={mutedUserIds.includes(viewerProfile.id)}
              moderationTargets={isAdmin ? members.map((member) => member.profile) : []}
              initialMutedUserIds={mutedUserIds}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
          <Lock className="h-6 w-6 text-neon-pink" aria-hidden="true" />
          <p className="font-medium text-foreground">This room is private</p>
          <p>Request to join to see posts and members.</p>
        </div>
      )}
    </div>
  );
}
