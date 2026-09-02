import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "@/components/profile/profile-view";
import { getCreatorProfilePosts } from "@/lib/posts";
import { getCreatorStats } from "@/lib/creator";
import { getPublicTiers } from "@/lib/tiers";
import { getBlockRelationship } from "@/lib/block";
import { getProfileVisibility } from "@/lib/circles";
import { getReviewableContexts, getReviewsForProfile, getReviewSummary } from "@/lib/reviews";
import { confirmProviderPayment } from "@/lib/providers";
import { getProviderServiceListings } from "@/lib/service-listings";
import { isProviderProfileType } from "@/lib/provider-types";

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { section?: string; reference?: string };
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
      ? await prisma.profile.findUnique({
          where: { userId: session.user.id },
          select: { id: true, heartsBalance: true },
        })
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

  if (searchParams.reference && viewerProfile) {
    await confirmProviderPayment(searchParams.reference);
  }

  const visibility = await getProfileVisibility(profile.id, viewerProfile?.id ?? null, isOwner);

  const viewerOrOwnerId = isOwner ? profile.id : (viewerProfile?.id ?? null);
  const isProvider = isProviderProfileType(profile.profileType);

  const [posts, subscriptions, serviceListings, stats] = await Promise.all([
    getCreatorProfilePosts(profile.id, viewerOrOwnerId),
    getPublicTiers(profile.id, viewerOrOwnerId),
    getProviderServiceListings(profile.id),
    getCreatorStats(profile.id),
  ]);

  const [reviewSummary, reviews, reviewableContexts] = await Promise.all([
    getReviewSummary(profile.id),
    getReviewsForProfile(profile.id),
    viewerProfile ? getReviewableContexts(viewerProfile.id, profile.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ProfileView
        profile={profile}
        posts={posts}
        subscription={subscriptions[0] ?? null}
        serviceListings={serviceListings}
        isOwner={isOwner}
        isProvider={isProvider}
        canMessage={!isOwner && Boolean(viewerProfile)}
        viewerHeartsBalance={viewerProfile?.heartsBalance ?? 0}
        canModerate={!isOwner && Boolean(viewerProfile)}
        reviewSummary={reviewSummary}
        reviews={reviews}
        reviewableContexts={reviewableContexts}
        visibleProfileFields={visibility.profileFields}
        profileHref={`/profile/${profile.username}`}
        activeSection={searchParams.section}
        stats={stats}
      />
    </div>
  );
}
