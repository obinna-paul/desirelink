import Link from "next/link";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { Bell, Briefcase } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { TopBarSearch } from "@/components/layout/top-bar-search";
import { AvailabilityQuickAction } from "@/components/layout/availability-quick-action";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <header className="sticky top-0 z-40 bg-white px-3 py-1.5 dark:bg-background/95 dark:backdrop-blur dark:supports-[backdrop-filter]:bg-background/82 md:flex md:h-14 md:items-center md:justify-between md:bg-background/95 md:px-7 md:py-0 md:backdrop-blur md:supports-[backdrop-filter]:bg-background/82">
      <div className="flex flex-col gap-2 md:hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center">
            <Button asChild variant="ghost" size="icon" aria-label="Events and services">
              <Link href="/work">
                <Briefcase className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <Link href="/" className="flex min-h-11 items-center justify-center" aria-label="udala home">
            <span className="font-heading text-2xl font-semibold tracking-tight text-primary">udala</span>
          </Link>

          <div className="flex items-center justify-end">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <Suspense fallback={<div className="h-11 w-full rounded-full bg-muted" />}>
          <TopBarSearch className="w-full sm:w-full md:w-full" />
        </Suspense>
      </div>

      <div className="hidden w-full items-center justify-between md:flex">
        <Link
          href="/"
          className="flex min-h-11 min-w-0 items-center gap-2 text-xl font-bold tracking-tight"
        >
          <span className="font-heading text-primary">udala</span>
        </Link>

        <div className="flex items-center gap-1 md:gap-2">
          <Suspense fallback={<div className="h-9 w-28 sm:w-44 md:w-64" />}>
            <TopBarSearch />
          </Suspense>
          {profile && <AvailabilityQuickAction initialStatus={activeStatus} />}
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Button>
          <SignOutButton />
          <Link href="/profile" className="flex h-11 w-11 items-center justify-center">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={profile?.avatarUrl} alt="Your avatar" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}
