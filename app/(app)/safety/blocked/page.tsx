import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BlockedList } from "@/components/safety/blocked-list";
import { getBlockedProfiles } from "@/lib/block";

export const dynamic = "force-dynamic";

export default async function BlockedUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!viewerProfile) {
    redirect("/login");
  }

  const blocks = await getBlockedProfiles(viewerProfile.id);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <BlockedList initialBlocks={blocks} />
    </div>
  );
}
