import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getNearbyActiveSnapshot,
  NEARBY_ACTIVE_RADIUS_KM,
  type NearbyActiveSnapshot,
} from "@/lib/availability";
import { getLiveRingFeed } from "@/lib/live-streams";
import { getHomeServiceListings } from "@/lib/service-listings";
import { isProviderProfileType } from "@/lib/provider-types";
import { AvailableNowSidebar } from "@/components/home/available-now-sidebar";
import { ExplorerDiscoveryPanel } from "@/components/home/explorer-discovery-panel";
import { HomeOnlyQuickActions } from "@/components/layout/home-only-quick-actions";

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
          locationLat: true,
          locationLng: true,
          openToChat: true,
          openToMeet: true,
          showInSearch: true,
          showExactLocation: true,
          isVerified: true,
          isVerifiedCreator: true,
          isVerifiedServiceProvider: true,
          profileType: true,
        },
      })
    : null;
  const isProvider = viewerProfile ? isProviderProfileType(viewerProfile.profileType) : false;

  const emptyNearbySnapshot: NearbyActiveSnapshot = {
    locationReady: false,
    onlineCount: 0,
    radiusKm: NEARBY_ACTIVE_RADIUS_KM,
    items: [],
  };
  const [nearbySnapshot, onlineCreators, serviceListings] = await Promise.all([
    viewerProfile
      ? getNearbyActiveSnapshot({
          id: viewerProfile.id,
          locationLat: viewerProfile.locationLat,
          locationLng: viewerProfile.locationLng,
        })
      : Promise.resolve(emptyNearbySnapshot),
    !isProvider && viewerProfile ? getLiveRingFeed(viewerProfile.id, 4) : Promise.resolve([]),
    !isProvider && viewerProfile ? getHomeServiceListings(3) : Promise.resolve([]),
  ]);

  return (
    <aside
      aria-label="People nearby"
      className="sticky top-16 hidden h-[calc(100vh-4rem)] w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/60 bg-sidebar px-5 py-6 xl:flex"
    >
      {viewerProfile && <HomeOnlyQuickActions profile={viewerProfile} />}
      {viewerProfile && !isProvider && (
        <ExplorerDiscoveryPanel
          onlineCreators={onlineCreators}
          services={serviceListings}
        />
      )}
      <AvailableNowSidebar
        initialSnapshot={nearbySnapshot}
        viewerProfileId={viewerProfile?.id ?? null}
      />
    </aside>
  );
}
