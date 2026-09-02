import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LiveRingRow } from "@/components/home/live-ring-row";
import { FeedTabs } from "@/components/home/feed-tabs";
import { getPublicFeedPosts } from "@/lib/posts";
import { getLiveRingFeed } from "@/lib/live-streams";
import { isProviderProfileType } from "@/lib/provider-types";
import { getOwnPresenceStatus } from "@/lib/presence";

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
      lastActiveAt: true,
    },
  });

  const isProvider = viewerProfile ? isProviderProfileType(viewerProfile.profileType) : false;

  const [posts, ring, myActiveStream] = await Promise.all([
    getPublicFeedPosts(viewerProfile?.id ?? null),
    getLiveRingFeed(viewerProfile?.id ?? null),
    isProvider && viewerProfile
      ? prisma.liveStream.findFirst({ where: { providerId: viewerProfile.id, status: "live" }, select: { id: true } })
      : null,
  ]);

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      <LiveRingRow
        initialRing={ring}
        self={
          viewerProfile
            ? {
                username: viewerProfile.username,
                displayName: viewerProfile.displayName,
                avatarUrl: viewerProfile.avatarUrl,
                isProvider,
                presenceStatus: getOwnPresenceStatus(viewerProfile),
                activeStreamId: myActiveStream?.id ?? null,
              }
            : null
        }
      />
      <FeedTabs posts={posts} liveEntries={ring} />
    </div>
  );
}
