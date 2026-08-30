import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { PageHeader } from "@/components/layout/page-header";
import { SwitchToProviderForm } from "@/components/settings/switch-to-provider-form";

export default async function AccountTypeSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      profileType: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      gender: true,
      orientation: true,
      locationLat: true,
      locationLng: true,
      city: true,
      country: true,
      serviceCategories: true,
      isVerified: true,
      openToChat: true,
      openToMeet: true,
      showInSearch: true,
      showExactLocation: true,
      isIncognito: true,
    },
  });
  if (!profile) {
    redirect("/login");
  }
  if (isProviderProfileType(profile.profileType)) {
    redirect("/settings");
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Switch to Provider"
          description="Unlock hosting events, listing services, and creating paid content."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Switch to Provider
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unlock hosting events, listing services, and creating paid content.
        </p>
      </div>
      <SwitchToProviderForm currentProfile={profile} />
    </div>
  );
}
