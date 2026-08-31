import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";

import { ProviderUpgradePrompt } from "@/components/settings/provider-upgrade-prompt";
import { ServiceListingManager } from "@/components/provider/ServiceListingManager";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { getProviderServiceListings } from "@/lib/service-listings";
import { getMyVerificationRequests } from "@/lib/verification";

export default async function EditServicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/profile");

  const isProvider = isProviderProfileType(profile.profileType);
  const [listings, requests] = await Promise.all([
    isProvider ? getProviderServiceListings(profile.id) : Promise.resolve([]),
    isProvider ? getMyVerificationRequests(profile.id) : Promise.resolve([]),
  ]);
  const latestRequest = requests.find((request) => request.requestType === "service_provider") ?? null;

  return (
    <div className="mx-auto w-full max-w-4xl pb-8">
      <Link
        href="/profile/edit"
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Edit profile
      </Link>
      {isProvider ? (
        <ServiceListingManager
          initialListings={listings}
          isVerifiedServiceProvider={profile.isVerifiedServiceProvider}
          latestServiceProviderStatus={latestRequest?.status ?? null}
        />
      ) : (
        <ProviderUpgradePrompt intent="service" />
      )}
    </div>
  );
}
