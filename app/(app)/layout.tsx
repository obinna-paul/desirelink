import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { AppShell } from "@/components/layout/app-shell";
import { CreatorWelcomeModal } from "@/components/creator/creator-welcome-modal";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const profile = session?.user?.id
    ? await prisma.profile.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          profileType: true,
          usernameChosen: true,
          emailChosen: true,
          username: true,
          creatorWelcomeShownAt: true,
        },
      })
    : null;
  if (profile && !profile.usernameChosen) {
    redirect("/onboarding/username");
  }
  if (profile && !profile.emailChosen) {
    redirect("/onboarding/email");
  }
  const isProvider = profile ? isProviderProfileType(profile.profileType) : false;
  const showCreatorWelcome = isProvider && !!profile && !profile.creatorWelcomeShownAt;

  return (
    <>
      <AppShell isProvider={isProvider} viewerProfileId={profile?.id ?? null}>{children}</AppShell>
      {showCreatorWelcome && <CreatorWelcomeModal profileHref={`/profile/${profile!.username}`} />}
    </>
  );
}
