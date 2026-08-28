import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { HomeTabs } from "@/components/home/home-tabs";
import { PostList } from "@/components/posts/post-list";
import { EventGrid } from "@/components/events/event-grid";
import { ServiceListingGrid } from "@/components/home/service-listing-grid";
import {
  DEFAULT_HOME_TAB,
  isHomeTabValue,
} from "@/lib/home-feed";
import { getPublicFeedPosts } from "@/lib/posts";
import { getHomeUpcomingEvents } from "@/lib/events";
import { getHomeServiceListings } from "@/lib/service-listings";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/landing");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, profileType: true, locationLat: true, locationLng: true },
  });

  const activeTab = isHomeTabValue(searchParams.tab) ? searchParams.tab : DEFAULT_HOME_TAB;

  const tabContent =
    activeTab === "events"
      ? (
          <EventGrid
            events={await getHomeUpcomingEvents(viewerProfile, 24)}
            emptyMessage="No upcoming events yet. Head to Events to host one."
          />
        )
      : activeTab === "services"
        ? (
            <ServiceListingGrid
              listings={await getHomeServiceListings(24)}
              emptyMessage="No services are listed yet. Service providers can add offerings from profile settings."
            />
          )
        : (
            <PostList
              posts={await getPublicFeedPosts(viewerProfile?.id ?? null)}
              emptyMessage="No public posts yet. Creators, pairs, and service providers can publish from Create."
            />
          );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Home"
          description="Public posts, upcoming events, and services from the Udala community."
        />
      </div>
      <HomeTabs activeTab={activeTab} />
      {tabContent}
    </div>
  );
}
