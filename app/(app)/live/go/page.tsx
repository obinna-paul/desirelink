import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoLiveStaging } from "@/components/live/go-live-staging";
import { getActiveStreamForProvider } from "@/lib/live-streams";
import { isProviderProfileType } from "@/lib/provider-types";
import { isLiveKitConfigured } from "@/lib/livekit";
import { getLiveRequestPresets } from "@/lib/live-requests";
import { hasIdentityOnFile } from "@/lib/verification";
import { VerificationRequestCard } from "@/components/verification/verification-request-card";

export default async function GoLivePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, profileType: true },
  });
  if (!profile || !isProviderProfileType(profile.profileType)) {
    redirect("/");
  }

  const existing = await getActiveStreamForProvider(profile.id);
  if (existing) {
    redirect(`/live/${existing.id}`);
  }

  if (!(await hasIdentityOnFile(profile.id))) {
    return (
      <div className="mx-auto max-w-md">
        <VerificationRequestCard requestType="creator" isVerified={false} latestStatus={null} />
      </div>
    );
  }

  const requestPresets = await getLiveRequestPresets(profile.id);

  return (
    <div>
      {isLiveKitConfigured() ? (
        <GoLiveStaging defaultTitle={`${profile.displayName}'s live stream`} defaultRequestOptions={requestPresets} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          Live streaming isn&apos;t configured on this deployment yet.
        </p>
      )}
    </div>
  );
}
