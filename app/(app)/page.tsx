import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, Sparkles } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LiveRingRow } from "@/components/home/live-ring-row";
import { FeedTabs } from "@/components/home/feed-tabs";
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

  const isProvider = viewerProfile ? isProviderProfileType(viewerProfile.profileType) : false;

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      {isProvider && (
        <Link
          href="/creator-dashboard"
          className="flex items-center gap-3 rounded-2xl border border-accent-tint-border bg-accent-tint px-4 py-3 text-primary"
        >
          <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="label-caps flex-1 text-[11px]">Creator Studio · view earnings &amp; subscribers</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      )}
      <LiveRingRow
        initialRing={ring}
        self={
          viewerProfile
            ? {
                username: viewerProfile.username,
                displayName: viewerProfile.displayName,
                avatarUrl: viewerProfile.avatarUrl,
                isProvider,
              }
            : null
        }
      />
      <FeedTabs posts={posts} liveEntries={ring} />
    </div>
  );
}
