import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PostList } from "@/components/posts/post-list";
import { LiveRingRow } from "@/components/home/live-ring-row";
import { getPublicFeedPosts } from "@/lib/posts";
import { getLiveRingFeed } from "@/lib/live-streams";
import { isProviderProfileType } from "@/lib/provider-types";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/landing");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      profileType: true,
      locationLat: true,
      locationLng: true,
    },
  });

  const [posts, ring] = await Promise.all([
    getPublicFeedPosts(viewerProfile?.id ?? null),
    getLiveRingFeed(viewerProfile?.id ?? null),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Home" description="Public posts from the udala community." />
      </div>
      <LiveRingRow
        initialRing={ring}
        self={
          viewerProfile
            ? {
                username: viewerProfile.username,
                displayName: viewerProfile.displayName,
                avatarUrl: viewerProfile.avatarUrl,
                isProvider: isProviderProfileType(viewerProfile.profileType),
              }
            : null
        }
      />
      <PostList posts={posts} emptyMessage="No public posts yet. Publish from Create when you are ready." />
    </div>
  );
}
