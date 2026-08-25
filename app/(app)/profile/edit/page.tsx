import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { PartnerLinkPanel } from "@/components/profile/partner-link-panel";
import { ServiceListingManager } from "@/components/provider/ServiceListingManager";
import { getPartnerState } from "@/lib/partners";
import { getProviderServiceListings } from "@/lib/service-listings";

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    redirect("/profile");
  }

  const showPartnerPanel = profile.profileType === "PAIR" || profile.partnerId !== null;
  const [partnerState, serviceListings] = await Promise.all([
    showPartnerPanel ? getPartnerState(profile.id) : Promise.resolve(null),
    profile.profileType === "SERVICE_PROVIDER" ? getProviderServiceListings(profile.id) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit Profile" description="Update how others see you on udala." />
      <EditProfileForm profile={profile} />
      {partnerState && <PartnerLinkPanel initialState={partnerState} />}
      {serviceListings && <ServiceListingManager initialListings={serviceListings} />}
    </div>
  );
}
