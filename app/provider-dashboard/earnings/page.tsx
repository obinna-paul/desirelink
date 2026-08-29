import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { ProviderEarningsDashboard } from "@/components/provider/provider-earnings-dashboard";
import { getProviderEarningsDashboard } from "@/lib/rewards/earnings";

export default async function ProviderEarningsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    redirect("/login");
  }

  const earnings = await getProviderEarningsDashboard(profile.id);
  if (!earnings) {
    redirect("/creator-dashboard");
  }

  return (
    <AppShell>
      <ProviderEarningsDashboard data={earnings} providerId={profile.id} />
    </AppShell>
  );
}
