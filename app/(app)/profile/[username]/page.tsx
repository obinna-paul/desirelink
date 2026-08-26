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
import { confirmProviderPayment, isProviderProfileType } from "@/lib/providers";
import { getProviderServiceListings } from "@/lib/service-listings";
import { trackContentView, trackProfileView as trackPremiumProfileView, trackServiceView } from "@/lib/rewards/tracking";
import { isPremiumUser, recordProfileVisit } from "@/lib/premium";

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
          select: { id: true, isIncognito: true },
        })
      : null;

  const blockRelationship = viewerProfile
    ? await getBlockRelationship(viewerProfile.id, profile.id)
    : "none";

  if (blockRelationship !== "none") {
    notFound();
  }

  if (!isOwner) {
    await recordProfileVisit(profile.id, viewerProfile);
  }

  if (searchParams.reference && viewerProfile) {
    await confirmProviderPayment(searchParams.reference);
  }

  const visibility = await getProfileVisibility(profile.id, viewerProfile?.id ?? null, isOwner);
  const desires = await getVisibleDesires(profile.id, visibility);

  const viewerOrOwnerId = isOwner ? profile.id : (viewerProfile?.id ?? null);
  const isProvider = isProviderProfileType(profile.profileType);

  const posts = profile.profileType === "CREATOR" ? await getCreatorProfilePosts(profile.id, viewerOrOwnerId) : [];
  const tiers = isProvider ? await getPublicTiers(profile.id, viewerOrOwnerId) : [];
  const serviceListings =
    profile.profileType === "SERVICE_PROVIDER" ? await getProviderServiceListings(profile.id) : [];

  if (viewerProfile && isProvider) {
    await trackPremiumProfileView(profile.id, viewerProfile.id);
    if (profile.profileType === "CREATOR" && posts.length > 0) {
      await trackContentView(profile.id, viewerProfile.id);
    }
    if (profile.profileType === "SERVICE_PROVIDER" && serviceListings.length > 0) {
      await trackServiceView(profile.id, viewerProfile.id);
    }
  }

  const [reviewSummary, reviews, reviewableContexts] = await Promise.all([
    getReviewSummary(profile.id),
    getReviewsForProfile(profile.id),
    viewerProfile ? getReviewableContexts(viewerProfile.id, profile.id) : Promise.resolve([]),
  ]);
  const profileIsPremium = await isPremiumUser(profile.id);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title={profile.displayName} description={`@${profile.username}`} />
      </div>
      <ProfileView
        profile={profile}
        desires={desires}
        posts={posts}
        tiers={tiers}
        serviceListings={serviceListings}
        isOwner={isOwner}
        isPremium={profileIsPremium}
        canMessage={!isOwner && Boolean(viewerProfile)}
        canModerate={!isOwner && Boolean(viewerProfile)}
        reviewSummary={reviewSummary}
        reviews={reviews}
        reviewableContexts={reviewableContexts}
        visibleProfileFields={visibility.profileFields}
        profileHref={`/profile/${profile.username}`}
        activeSection={searchParams.section === "posts" ? "posts" : "about"}
      />
    </div>
  );
}
