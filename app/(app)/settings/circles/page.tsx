import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CircleManager } from "@/components/circles/circle-manager";
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
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
          We couldn&apos;t find your profile. Please contact support.
        </div>
      </div>
    );
  }

  const circles = await getOwnedCircles(profile.id);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <CircleManager
        initialCircles={circles}
        desireCategories={profile.desires.map((desire) => desire.category)}
      />
    </div>
  );
}
