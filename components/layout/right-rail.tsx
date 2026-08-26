import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAvailableNow } from "@/lib/availability";
import { AvailableNowSidebar } from "@/components/home/available-now-sidebar";
import { ProfileSetupActions } from "@/components/profile/profile-setup-actions";

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
          isVerifiedHost: true,
          _count: { select: { desires: true } },
        },
      })
    : null;

  const items = await getAvailableNow(20, viewerProfile?.id);
  const baseNearbyCount =
    BASE_NEARBY_MIN + Math.floor(Math.random() * (BASE_NEARBY_MAX - BASE_NEARBY_MIN + 1));

  return (
    <aside
      aria-label="Who's around"
      className="sticky top-16 hidden h-[calc(100vh-4rem)] w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/60 px-5 py-6 xl:flex"
    >
      {viewerProfile && <ProfileSetupActions profile={viewerProfile} />}
      <AvailableNowSidebar
        initialItems={items}
        baseNearbyCount={baseNearbyCount}
        viewerProfileId={viewerProfile?.id ?? null}
      />
    </aside>
  );
}
