import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { DesireMapEditor } from "@/components/desires/desire-map-editor";
import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { PartnerLinkPanel } from "@/components/profile/partner-link-panel";
import { ProfileSetupActions } from "@/components/profile/profile-setup-actions";
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
    include: {
      desires: { orderBy: { createdAt: "asc" } },
      _count: { select: { desires: true } },
    },
  });

  if (!profile) {
    redirect("/profile");
  }

  const showPartnerPanel = profile.partnerId !== null;
  const [partnerState, serviceListings] = await Promise.all([
    showPartnerPanel ? getPartnerState(profile.id) : Promise.resolve(null),
    getProviderServiceListings(profile.id),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Edit Profile" description="Update how others see you on Udala." />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Edit profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Basics, privacy, verification, and desires.</p>
      </div>
      <div className="hidden md:block xl:hidden">
        <ProfileSetupActions profile={profile} />
      </div>
      <EditProfileForm profile={profile} />
      <section
        id="desire-map"
        className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6 md:shadow-card"
      >
        <div className="mb-5 flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Desire Map
          </p>
          <div className="max-w-2xl">
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Set what you want people and recommendations to understand.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose the strongest signal for one category at a time. Visibility stays controlled per item.
            </p>
          </div>
        </div>
        <DesireMapEditor
          initialDesires={profile.desires}
          redirectTo="/profile/edit#desire-map"
          submitLabel="Save Desire Map"
        />
      </section>
      {partnerState && <PartnerLinkPanel initialState={partnerState} />}
      <ServiceListingManager initialListings={serviceListings} />
    </div>
  );
}
