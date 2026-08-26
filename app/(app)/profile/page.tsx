import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileView } from "@/components/profile/profile-view";
import { getCreatorProfilePosts } from "@/lib/posts";
import { getPublicTiers } from "@/lib/tiers";
import { isProviderProfileType } from "@/lib/providers";
import { getProviderServiceListings } from "@/lib/service-listings";
import { isPremiumUser } from "@/lib/premium";

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
      <div className="flex flex-col gap-6">
        <PageHeader title="Profile" description="Manage your public profile and desires." />
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          We couldn&apos;t find your profile. Please contact support.
        </div>
      </div>
    );
  }

  const [posts, tiers, serviceListings, profileIsPremium] = await Promise.all([
    profile.profileType === "CREATOR" ? getCreatorProfilePosts(profile.id, profile.id) : Promise.resolve([]),
    isProviderProfileType(profile.profileType) ? getPublicTiers(profile.id, profile.id) : Promise.resolve([]),
    profile.profileType === "SERVICE_PROVIDER" ? getProviderServiceListings(profile.id) : Promise.resolve([]),
    isPremiumUser(profile.id),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Profile" description="Manage your public profile and desires." />
      </div>
      <ProfileView
        profile={profile}
        desires={profile.desires}
        posts={posts}
        tiers={tiers}
        serviceListings={serviceListings}
        isOwner
        isPremium={profileIsPremium}
        profileHref="/profile"
        activeSection={searchParams.section === "posts" ? "posts" : "about"}
      />
    </div>
  );
}
