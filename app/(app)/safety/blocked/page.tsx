import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
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
      <div className="hidden md:block">
        <PageHeader
          title="Blocked users"
          description="They cannot message you, see your profile, or follow you while blocked."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Blocked users
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage who cannot contact or view you.</p>
      </div>
      <BlockedList initialBlocks={blocks} />
    </div>
  );
}
