import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { HomeTabs } from "@/components/home/home-tabs";
import { ProfileGrid } from "@/components/home/profile-grid";
import { AvailableTonightStrip } from "@/components/home/available-tonight-strip";
import { PostList } from "@/components/posts/post-list";
import {
  DEFAULT_HOME_TAB,
  getHomeFeed,
  isHomeTabValue,
  searchProfiles,
  type HomeTabValue,
} from "@/lib/home-feed";
import { getAvailableTonight } from "@/lib/availability";
import { getFeedPosts } from "@/lib/posts";

const EMPTY_MESSAGES: Record<HomeTabValue, string> = {
  browse: "No one to show yet. Check back soon.",
  feed: "",
  chat: "No one is open to chat right now.",
  flirt: 'No matches for Flirt right now. Add "Flirting" to your own Desire Map to be found here.',
  meet: "No one open to meeting nearby right now.",
  events: "",
  creators: "No creators yet.",
  couples: "No couples profiles yet.",
  explore: "No new members yet.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, locationLat: true, locationLng: true },
  });

  const availableTonight = await getAvailableTonight(20, viewerProfile?.id);

  const query = searchParams.q?.trim();

  if (query) {
    const results = await searchProfiles(query, viewerProfile);
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Search" description={`Results for "${query}"`} />
        <AvailableTonightStrip items={availableTonight} />
        <ProfileGrid profiles={results} emptyMessage={`No one found matching "${query}".`} />
      </div>
    );
  }

  const tab = isHomeTabValue(searchParams.tab) ? searchParams.tab : DEFAULT_HOME_TAB;

  if (tab === "events") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Home"
          description="Browse profiles across DesireLink, filtered by what you're into right now."
        />
        <AvailableTonightStrip items={availableTonight} />
        <HomeTabs activeTab={tab} />
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          Event listings are coming soon. Hosting and RSVPs will show up here.
        </div>
      </div>
    );
  }

  if (tab === "feed") {
    const posts = await getFeedPosts(viewerProfile?.id ?? null);
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Home"
          description="Browse profiles across DesireLink, filtered by what you're into right now."
        />
        <AvailableTonightStrip items={availableTonight} />
        <HomeTabs activeTab={tab} />
        <PostList
          posts={posts}
          emptyMessage="No posts yet. Subscribe to creators to see their posts here."
        />
      </div>
    );
  }

  const { profiles, note } = await getHomeFeed(tab, viewerProfile);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Home"
        description="Browse profiles across DesireLink, filtered by what you're into right now."
      />
      <AvailableTonightStrip items={availableTonight} />
      <HomeTabs activeTab={tab} />
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      <ProfileGrid profiles={profiles} emptyMessage={EMPTY_MESSAGES[tab]} />
    </div>
  );
}
