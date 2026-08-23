import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import type { PrivacyLevel } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileView } from "@/components/profile/profile-view";
import { getCreatorProfilePosts } from "@/lib/posts";

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { section?: string };
}) {
  const session = await getServerSession(authOptions);

  const profile = await prisma.profile.findUnique({
    where: { username: params.username },
  });

  if (!profile) {
    notFound();
  }

  const isOwner = session?.user?.id === profile.userId;

  if (!isOwner) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: { profileViews: { increment: 1 } },
    });
  }

  const viewerProfile =
    !isOwner && session?.user?.id
      ? await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
      : null;

  let visiblePrivacyLevels: PrivacyLevel[] = ["public"];

  if (isOwner) {
    visiblePrivacyLevels = ["public", "followers", "private"];
  } else if (viewerProfile) {
    const isFollower = Boolean(
      await prisma.circleMember.findFirst({
        where: { userId: viewerProfile.id, circle: { userId: profile.id } },
      })
    );

    if (isFollower) {
      visiblePrivacyLevels = ["public", "followers"];
    }
  }

  const desires = await prisma.desire.findMany({
    where: { userId: profile.id, privacy: { in: visiblePrivacyLevels } },
    orderBy: { createdAt: "asc" },
  });

  const posts = profile.isCreator
    ? await getCreatorProfilePosts(profile.id, isOwner ? profile.id : (viewerProfile?.id ?? null))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={profile.displayName} description={`@${profile.username}`} />
      <ProfileView
        profile={profile}
        desires={desires}
        posts={posts}
        isOwner={isOwner}
        profileHref={`/profile/${profile.username}`}
        activeSection={searchParams.section === "posts" ? "posts" : "about"}
      />
    </div>
  );
}
