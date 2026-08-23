import Link from "next/link";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { TopBarSearch } from "@/components/layout/top-bar-search";
import { AvailabilityQuickAction } from "@/components/layout/availability-quick-action";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveAvailability } from "@/lib/availability";

export async function TopBar() {
  const session = await getServerSession(authOptions);
  const profile = session?.user?.id
    ? await prisma.profile.findUnique({
        where: { userId: session.user.id },
        select: { id: true, avatarUrl: true, displayName: true },
      })
    : null;

  const activeStatus = profile ? await getActiveAvailability(profile.id) : null;

  const initials = profile?.displayName ? profile.displayName.slice(0, 2).toUpperCase() : "YOU";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <Link href="/" className="text-xl font-bold tracking-tight">
        <span className="bg-gradient-to-r from-neon-pink to-neon-cyan bg-clip-text text-transparent">
          DesireLink
        </span>
      </Link>

      <div className="flex items-center gap-1 md:gap-2">
        <Suspense fallback={<div className="h-9 w-28 sm:w-44 md:w-64" />}>
          <TopBarSearch />
        </Suspense>
        {profile && <AvailabilityQuickAction initialStatus={activeStatus} />}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>
        <SignOutButton />
        <Link href="/profile">
          <Avatar className="h-8 w-8 border border-border">
            <AvatarImage src={profile?.avatarUrl} alt="Your avatar" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
