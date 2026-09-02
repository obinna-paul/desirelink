import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "@/components/profile/profile-view";
import { getCreatorProfilePosts } from "@/lib/posts";
import { getCreatorStats } from "@/lib/creator";
import { getPublicTiers } from "@/lib/tiers";
import { getProviderServiceListings } from "@/lib/service-listings";
import { getReviewSummary, getReviewsForProfile } from "@/lib/reviews";
import { isProviderProfileType } from "@/lib/provider-types";
import { ALL_PROFILE_FIELD_NAMES } from "@/lib/circles";

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
      partner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  if (!profile) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
          We couldn&apos;t find your profile. Please contact support.
        </div>
      </div>
    );
  }

  const isProvider = isProviderProfileType(profile.profileType);

  const [posts, subscriptions, serviceListings, reviewSummary, reviews, stats] =
    await Promise.all([
      getCreatorProfilePosts(profile.id, profile.id),
      getPublicTiers(profile.id, profile.id),
      getProviderServiceListings(profile.id),
      getReviewSummary(profile.id),
      getReviewsForProfile(profile.id),
      getCreatorStats(profile.id),
    ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ProfileView
        profile={profile}
        posts={posts}
        subscription={subscriptions[0] ?? null}
        serviceListings={serviceListings}
        isOwner
        isProvider={isProvider}
        profileHref="/profile"
        activeSection={searchParams.section}
        reviewSummary={reviewSummary}
        reviews={reviews}
        visibleProfileFields={ALL_PROFILE_FIELD_NAMES}
        stats={stats}
      />
    </div>
  );
}
