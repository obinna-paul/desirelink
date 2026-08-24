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
      <div className="flex flex-col gap-6">
        <PageHeader title="Circles" description="Choose who can see more of your profile." />
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          We couldn&apos;t find your profile. Please contact support.
        </div>
      </div>
    );
  }

  const circles = await getOwnedCircles(profile.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Circles" description="Choose who can see more of your profile." />
      <CircleManager
        initialCircles={circles}
        desireCategories={profile.desires.map((desire) => desire.category)}
      />
    </div>
  );
}
