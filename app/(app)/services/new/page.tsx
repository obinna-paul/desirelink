import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderServiceListings } from "@/lib/service-listings";
import { getMyVerificationRequests } from "@/lib/verification";
import { ServiceListingManager } from "@/components/provider/ServiceListingManager";

export default async function NewServicePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, isVerifiedServiceProvider: true },
  });
  if (!profile) {
    redirect("/login");
  }

  const [serviceListings, requests] = await Promise.all([
    getProviderServiceListings(profile.id),
    getMyVerificationRequests(profile.id),
  ]);
  const latestServiceProviderRequest = requests.find((request) => request.requestType === "service_provider") ?? null;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ServiceListingManager
        initialListings={serviceListings}
        startCreating
        isVerifiedServiceProvider={profile.isVerifiedServiceProvider}
        latestServiceProviderStatus={latestServiceProviderRequest?.status ?? null}
      />
    </div>
  );
}
