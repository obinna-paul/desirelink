import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditProfileForm, type EditableSectionId } from "@/components/profile/edit-profile-form";
import { PartnerLinkPanel } from "@/components/profile/partner-link-panel";
import { getPartnerState } from "@/lib/partners";

const VALID_SECTIONS: EditableSectionId[] = [
  "basics",
  "photos",
  "location",
  "privacy",
  "availability",
];

async function getLatestUsernameChange(profileId: string) {
  try {
    return await prisma.usernameAlias.findFirst({
      where: { profileId },
      orderBy: { changedAt: "desc" },
      select: { changedAt: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return null;
    }
    throw error;
  }
}

export default async function EditProfilePage({
  searchParams,
}: {
  searchParams: { section?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });

  if (!profile) {
    redirect("/profile");
  }

  const showPartnerPanel = profile.partnerId !== null;
  const [partnerState, latestUsernameAlias] = await Promise.all([
    showPartnerPanel ? getPartnerState(profile.id) : Promise.resolve(null),
    getLatestUsernameChange(profile.id),
  ]);
  const initialSection = VALID_SECTIONS.find((section) => section === searchParams.section);

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <EditProfileForm
        profile={profile}
        initialSection={initialSection}
        usernameChangedAt={latestUsernameAlias?.changedAt.toISOString() ?? null}
      />
      {partnerState && <PartnerLinkPanel initialState={partnerState} />}
    </div>
  );
}
