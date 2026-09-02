import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAvailableNow } from "@/lib/availability";
import { getLiveRingFeed } from "@/lib/live-streams";
import { getHomeServiceListings } from "@/lib/service-listings";
import { isProviderProfileType } from "@/lib/provider-types";
import { AvailableNowSidebar } from "@/components/home/available-now-sidebar";
import { ExplorerDiscoveryPanel } from "@/components/home/explorer-discovery-panel";
import { HomeOnlyQuickActions } from "@/components/layout/home-only-quick-actions";

const BASE_NEARBY_MIN = 8;
const BASE_NEARBY_MAX = 22;

export async function RightRail() {
  const session = await getServerSession(authOptions);
  const viewerProfile = session?.user?.id
    ? await prisma.profile.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          avatarUrl: true,
          bio: true,
          city: true,
          country: true,
          openToChat: true,
          openToMeet: true,
          showInSearch: true,
          showExactLocation: true,
          isVerified: true,
          isVerifiedCreator: true,
          profileType: true,
        },
      })
    : null;
  const isProvider = viewerProfile ? isProviderProfileType(viewerProfile.profileType) : false;

  const [items, onlineCreators, serviceListings] = await Promise.all([
    getAvailableNow(20, viewerProfile?.id),
    !isProvider && viewerProfile ? getLiveRingFeed(viewerProfile.id, 4) : Promise.resolve([]),
    !isProvider && viewerProfile ? getHomeServiceListings(3) : Promise.resolve([]),
  ]);
  const baseNearbyCount =
    BASE_NEARBY_MIN + Math.floor(Math.random() * (BASE_NEARBY_MAX - BASE_NEARBY_MIN + 1));

  return (
    <aside
      aria-label="People nearby"
      className="sticky top-16 hidden h-[calc(100vh-4rem)] w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/60 bg-sidebar px-5 py-6 xl:flex"
    >
      {viewerProfile && isProvider && <HomeOnlyQuickActions profile={viewerProfile} />}
      {viewerProfile && !isProvider && (
        <ExplorerDiscoveryPanel
          onlineCreators={onlineCreators}
          services={serviceListings}
        />
      )}
      <AvailableNowSidebar
        initialItems={items}
        baseNearbyCount={baseNearbyCount}
        viewerProfileId={viewerProfile?.id ?? null}
      />
    </aside>
  );
}
