import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const profile = session?.user?.id
    ? await prisma.profile.findUnique({
        where: { userId: session.user.id },
        select: { profileType: true, usernameChosen: true },
      })
    : null;
  if (profile && !profile.usernameChosen) {
    redirect("/onboarding/username");
  }
  const isProvider = profile ? isProviderProfileType(profile.profileType) : false;

  return <AppShell isProvider={isProvider}>{children}</AppShell>;
}
