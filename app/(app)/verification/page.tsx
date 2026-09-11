import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { getMyVerificationRequests } from "@/lib/verification";
import { BackLink } from "@/components/layout/back-link";
import { VerificationRequestCard } from "@/components/verification/verification-request-card";

export default async function VerificationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      profileType: true,
      isVerified: true,
      isVerifiedCreator: true,
      isVerifiedServiceProvider: true,
    },
  });
  if (!profile) {
    redirect("/login");
  }

  const isVerified =
    profile.isVerified ||
    profile.isVerifiedCreator ||
    profile.isVerifiedServiceProvider;
  const isProvider = isProviderProfileType(profile.profileType);

  const requests = await getMyVerificationRequests(profile.id);
  const latestStatus: "pending" | "approved" | "denied" | null = requests[0]?.status ?? null;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <BackLink />

      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirm your identity to build trust across the app.</p>
      </div>

      {isProvider ? (
        <VerificationRequestCard
          requestType="creator"
          isVerified={isVerified}
          latestStatus={latestStatus}
        />
      ) : (
        <VerificationRequestCard
          requestType="member"
          isVerified={isVerified}
          latestStatus={latestStatus}
          heading="Verify your identity to send messages."
          verifiedLabel="You're verified."
          verifiedBadgeLabel="Verified"
        />
      )}
    </div>
  );
}
