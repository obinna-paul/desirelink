import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileView } from "@/components/profile/profile-view";
import { getCreatorProfilePosts } from "@/lib/posts";
import { getPublicTiers } from "@/lib/tiers";
import { getBlockRelationship } from "@/lib/block";
import { getProfileVisibility, getVisibleDesires } from "@/lib/circles";
import { getReviewableContexts, getReviewsForProfile, getReviewSummary } from "@/lib/reviews";

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
    include: {
      partner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  if (!profile) {
    notFound();
  }

  const isOwner = session?.user?.id === profile.userId;

  const viewerProfile =
    !isOwner && session?.user?.id
      ? await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
      : null;

  const blockRelationship = viewerProfile
    ? await getBlockRelationship(viewerProfile.id, profile.id)
    : "none";

  if (blockRelationship !== "none") {
    notFound();
  }

  if (!isOwner) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: { profileViews: { increment: 1 } },
    });
  }

  const visibility = await getProfileVisibility(profile.id, viewerProfile?.id ?? null, isOwner);
  const desires = await getVisibleDesires(profile.id, visibility);

  const viewerOrOwnerId = isOwner ? profile.id : (viewerProfile?.id ?? null);

  const posts = profile.isCreator ? await getCreatorProfilePosts(profile.id, viewerOrOwnerId) : [];
  const tiers = profile.isCreator ? await getPublicTiers(profile.id, viewerOrOwnerId) : [];

  const [reviewSummary, reviews, reviewableContexts] = await Promise.all([
    getReviewSummary(profile.id),
    getReviewsForProfile(profile.id),
    viewerProfile ? getReviewableContexts(viewerProfile.id, profile.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={profile.displayName} description={`@${profile.username}`} />
      <ProfileView
        profile={profile}
        desires={desires}
        posts={posts}
        tiers={tiers}
        isOwner={isOwner}
        canMessage={!isOwner && Boolean(viewerProfile)}
        canModerate={!isOwner && Boolean(viewerProfile)}
        reviewSummary={reviewSummary}
        reviews={reviews}
        reviewableContexts={reviewableContexts}
        visibleProfileFields={visibility.profileFields}
        profileHref={`/profile/${profile.username}`}
        activeSection={
          searchParams.section === "posts"
            ? "posts"
            : searchParams.section === "membership"
              ? "membership"
              : "about"
        }
      />
    </div>
  );
}
