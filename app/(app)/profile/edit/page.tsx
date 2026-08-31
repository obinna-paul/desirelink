import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { PartnerLinkPanel } from "@/components/profile/partner-link-panel";
import { getPartnerState } from "@/lib/partners";

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

  const showPartnerPanel = profile.partnerId !== null;
  const partnerState = showPartnerPanel ? await getPartnerState(profile.id) : null;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <EditProfileForm profile={profile} />
      {partnerState && <PartnerLinkPanel initialState={partnerState} />}
    </div>
  );
}
