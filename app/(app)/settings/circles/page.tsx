import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CircleManager } from "@/components/circles/circle-manager";
import { PageHeader } from "@/components/layout/page-header";
import { authOptions } from "@/lib/auth";
import { getOwnedCircles } from "@/lib/circles";
import { prisma } from "@/lib/prisma";

export default async function CirclesSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      desires: {
        select: { category: true },
        orderBy: { category: "asc" },
      },
    },
  });

  if (!profile) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="hidden md:block">
          <PageHeader title="Circles" description="Choose who can see more of your profile." />
        </div>
        <div className="md:hidden">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Circles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose who can see more of your profile.</p>
        </div>
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
          We couldn&apos;t find your profile. Please contact support.
        </div>
      </div>
    );
  }

  const circles = await getOwnedCircles(profile.id);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Circles" description="Choose who can see more of your profile." />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Circles
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Set private access groups.</p>
      </div>
      <CircleManager
        initialCircles={circles}
        desireCategories={profile.desires.map((desire) => desire.category)}
      />
    </div>
  );
}
