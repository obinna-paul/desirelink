import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { getMyVerificationRequests } from "@/lib/verification";
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

  let latestStatus: "pending" | "approved" | "denied" | null = null;
  if (isProvider) {
    const requests = await getMyVerificationRequests(profile.id);
    latestStatus = requests[0]?.status ?? null;
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Link
        href="/profile/edit"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Profile settings
      </Link>

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
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border/60 bg-card p-4 shadow-sm md:rounded-xl md:shadow-none">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="text-sm text-muted-foreground">
            <p>
              Identity verification is for provider accounts listing services or posting premium content.
            </p>
            <Link href="/settings/account-type" className="mt-2 inline-block font-medium text-foreground hover:underline">
              Switch to a provider account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
