import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { getAccountThemeClass } from "@/lib/account-theme";
import { GENDER_UNSPECIFIED } from "@/lib/profile-options";
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
          accountTypeChosen: true,
          emailChosen: true,
          gender: true,
          username: true,
          creatorWelcomeShownAt: true,
        },
      })
    : null;
  if (profile && !profile.usernameChosen) {
    redirect("/onboarding/username");
  }
  if (profile && !profile.accountTypeChosen) {
    redirect("/onboarding/account-type");
  }
  if (profile && !profile.emailChosen) {
    redirect("/onboarding/email");
  }
  // Gender was never asked at signup (every profile is created with this placeholder -
  // see app/api/signup/route.ts and lib/auth.ts), so this catches both a brand-new
  // signup and every pre-existing account the first time they load the app after this
  // gate shipped, not just new sign-ups like the three checks above.
  if (profile && profile.gender === GENDER_UNSPECIFIED) {
    redirect("/onboarding/gender");
  }
  const isProvider = profile ? isProviderProfileType(profile.profileType) : false;
  const showCreatorWelcome = isProvider && !!profile && !profile.creatorWelcomeShownAt;
  const accountThemeClass = profile ? getAccountThemeClass(profile.profileType) : "theme-olive";

  return (
    <>
      <AppShell isProvider={isProvider} accountThemeClass={accountThemeClass} viewerProfileId={profile?.id ?? null}>
        {children}
      </AppShell>
      {showCreatorWelcome && <CreatorWelcomeModal profileHref={`/profile/${profile!.username}`} />}
    </>
  );
}
