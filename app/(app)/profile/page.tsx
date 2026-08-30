import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ExplorerProfileView } from "@/components/profile/explorer-profile-view";
import { CreatorProfileView } from "@/components/profile/creator-profile-view";
import { getCreatorProfilePosts } from "@/lib/posts";
import { getCreatorStats } from "@/lib/creator";
import { getPublicTiers } from "@/lib/tiers";
import { getProviderServiceListings } from "@/lib/service-listings";
import { isPremiumUser } from "@/lib/premium";
import { getAttendingEvents, getProfileEvents } from "@/lib/events";
import { getReviewSummary, getReviewsForProfile } from "@/lib/reviews";
import { isProviderProfileType } from "@/lib/provider-types";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { section?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: {
      desires: { orderBy: { createdAt: "asc" } },
      partner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  if (!profile) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="hidden md:block">
          <PageHeader title="Profile" description="Manage your public profile and preferences." />
        </div>
        <div className="md:hidden">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your public profile.</p>
        </div>
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
          We couldn&apos;t find your profile. Please contact support.
        </div>
      </div>
    );
  }

  const isProvider = isProviderProfileType(profile.profileType);

  const [posts, tiers, serviceListings, events, attendingEvents, profileIsPremium, reviewSummary, reviews, stats] =
    await Promise.all([
      getCreatorProfilePosts(profile.id, profile.id),
      getPublicTiers(profile.id, profile.id),
      getProviderServiceListings(profile.id),
      getProfileEvents(profile.id, profile.id),
      getAttendingEvents(profile.id, profile.id),
      isPremiumUser(profile.id),
      getReviewSummary(profile.id),
      getReviewsForProfile(profile.id),
      isProvider ? getCreatorStats(profile.id) : Promise.resolve(null),
    ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Profile" description="Manage your public profile and preferences." />
      </div>
      {isProvider && stats ? (
        <CreatorProfileView
          profile={profile}
          desires={profile.desires}
          posts={posts}
          tiers={tiers}
          serviceListings={serviceListings}
          events={events}
          isOwner
          isPremium={profileIsPremium}
          profileHref="/profile"
          activeSection={searchParams.section}
          reviewSummary={reviewSummary}
          reviews={reviews}
          stats={stats}
        />
      ) : (
        <ExplorerProfileView
          profile={profile}
          desires={profile.desires}
          posts={posts}
          events={attendingEvents}
          isOwner
          profileHref="/profile"
          activeSection={searchParams.section}
          reviewSummary={reviewSummary}
          reviews={reviews}
        />
      )}
    </div>
  );
}
