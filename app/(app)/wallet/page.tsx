import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmHeartsPurchase } from "@/lib/hearts";
import { WalletOverviewSection } from "@/components/wallet/wallet-overview-section";

export default async function WalletPage({
  searchParams,
}: {
  searchParams: { reference?: string; mock_reference?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) {
    redirect("/login");
  }

  const reference = searchParams.reference ?? searchParams.mock_reference;
  if (reference) {
    await confirmHeartsPurchase(reference);
  }

  return <WalletOverviewSection profileId={profile.id} />;
}
