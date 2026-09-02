import type { Metadata } from "next";
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
import { getOwnPresenceStatus, getPresenceStatus } from "@/lib/presence";
import { absoluteUrl, SITE_NAME } from "@/lib/site-config";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const profile = await prisma.profile.findUnique({
    where: { username: params.username },
    select: {
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      isIncognito: true,
      showInSearch: true,
      isSuspended: true,
    },
  });
  if (!profile || profile.isSuspended) return { title: "Profile not found" };

  const title = `${profile.displayName} (@${profile.username})`;
  const description = profile.bio || `${profile.displayName}'s profile on ${SITE_NAME}.`;
  const image = profile.bannerUrl || profile.avatarUrl || undefined;
  const url = absoluteUrl(`/profile/${profile.username}`);
  const hideFromSearch = profile.isIncognito || !profile.showInSearch;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: hideFromSearch ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "profile",
      title,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

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
          select: { id: true, profileType: true },
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

  const [posts, subscriptions, serviceListings, stats, activeStream] = await Promise.all([
    getCreatorProfilePosts(profile.id, viewerOrOwnerId),
    getPublicTiers(profile.id, viewerOrOwnerId),
    getProviderServiceListings(profile.id),
    getCreatorStats(profile.id),
    isProvider
      ? prisma.liveStream.findFirst({ where: { providerId: profile.id, status: "live" }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  const presenceStatus = activeStream
    ? "live"
    : isOwner
      ? getOwnPresenceStatus(profile)
      : getPresenceStatus(profile, false);

  const [reviewSummary, reviews, reviewableContexts] = await Promise.all([
    getReviewSummary(profile.id),
    getReviewsForProfile(profile.id),
    viewerProfile ? getReviewableContexts(viewerProfile.id, profile.id) : Promise.resolve([]),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateCreated: profile.createdAt.toISOString(),
    mainEntity: {
      "@type": "Person",
      name: profile.displayName,
      alternateName: profile.username,
      description: profile.bio || undefined,
      image: profile.avatarUrl || undefined,
      url: absoluteUrl(`/profile/${profile.username}`),
    },
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProfileView
        profile={profile}
        posts={posts}
        subscription={subscriptions[0] ?? null}
        serviceListings={serviceListings}
        isOwner={isOwner}
        isProvider={isProvider}
        canMessage={!isOwner && Boolean(viewerProfile)}
        canModerate={!isOwner && Boolean(viewerProfile)}
        reviewSummary={reviewSummary}
        reviews={reviews}
        reviewableContexts={reviewableContexts}
        visibleProfileFields={visibility.profileFields}
        profileHref={`/profile/${profile.username}`}
        activeSection={searchParams.section}
        stats={stats}
        presenceStatus={presenceStatus}
        liveStreamId={activeStream?.id ?? null}
        viewerIsProvider={viewerProfile ? isProviderProfileType(viewerProfile.profileType) : false}
      />
    </div>
  );
}
