import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { getAccountThemeClass } from "@/lib/account-theme";
import { GENDER_UNSPECIFIED } from "@/lib/profile-options";
import { AppShell } from "@/components/layout/app-shell";
import { CreatorWelcomeModal } from "@/components/creator/creator-welcome-modal";
import { SpecTestNudgeModal } from "@/components/spec-test/spec-test-nudge-modal";
import { FirstPostNudgeModal } from "@/components/posts/first-post-nudge-modal";

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
          specTestNudgeShownAt: true,
          firstPostNudgeShownAt: true,
          specTestResults: { select: { id: true }, take: 1 },
          _count: { select: { posts: true } },
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
  // Never shown alongside the creator-welcome modal (that one's already a full-screen
  // moment for a brand-new creator) - it'll simply show on this same profile's next visit
  // instead, since specTestNudgeShownAt stays null until it's actually been shown.
  const showSpecNudge =
    !!profile && !showCreatorWelcome && !profile.specTestNudgeShownAt && profile.specTestResults.length === 0;
  // Prompt moments are deliberately serialized: a profile sees at most one modal on a
  // visit. This one waits until the earlier welcome/Spec moments have had their turn, then
  // the client adds a short delay so ordinary app content lands first.
  const showFirstPostNudge =
    !!profile &&
    !showCreatorWelcome &&
    !showSpecNudge &&
    !profile.firstPostNudgeShownAt &&
    profile._count.posts === 0;
  const accountThemeClass = profile ? getAccountThemeClass(profile.profileType) : "theme-olive";

  return (
    <>
      <AppShell isProvider={isProvider} accountThemeClass={accountThemeClass} viewerProfileId={profile?.id ?? null}>
        {children}
      </AppShell>
      {showCreatorWelcome && <CreatorWelcomeModal profileHref={`/profile/${profile!.username}`} />}
      {showSpecNudge && <SpecTestNudgeModal variant="global" />}
      {showFirstPostNudge && <FirstPostNudgeModal profileId={profile.id} />}
    </>
  );
}
