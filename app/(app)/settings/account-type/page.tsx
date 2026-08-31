import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { SwitchToProviderForm } from "@/components/settings/switch-to-provider-form";
import type { ProviderUpgradeIntent } from "@/components/settings/provider-upgrade-prompt";

const PROVIDER_UPGRADE_INTENTS: readonly ProviderUpgradeIntent[] = ["premium-post", "event", "service"];
const PROVIDER_INTENT_REDIRECTS: Record<ProviderUpgradeIntent | "default", string> = {
  default: "/settings",
  "premium-post": "/create",
  event: "/events/new",
  service: "/services/new",
};

function getIntent(value: string | string[] | undefined): ProviderUpgradeIntent | "default" {
  const intent = Array.isArray(value) ? value[0] : value;
  return PROVIDER_UPGRADE_INTENTS.includes(intent as ProviderUpgradeIntent)
    ? (intent as ProviderUpgradeIntent)
    : "default";
}

export default async function AccountTypeSettingsPage({
  searchParams,
}: {
  searchParams?: { intent?: string | string[] };
}) {
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
  const intent = getIntent(searchParams?.intent);
  if (isProviderProfileType(profile.profileType)) {
    redirect(PROVIDER_INTENT_REDIRECTS[intent]);
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <SwitchToProviderForm currentProfile={profile} intent={intent} />
    </div>
  );
}
