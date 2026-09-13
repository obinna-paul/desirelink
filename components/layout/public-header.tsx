import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/** Pass `minimal` on a focused, single-task flow (e.g. the Spec Test) to drop the
 *  auth nav and center the logo - there's nowhere else for that visitor to go until
 *  the task is done, so login/signup links are just noise, not navigation. Pass
 *  `badge` alongside it (e.g. an "18+" pill) to pin the logo left instead and show
 *  the badge on the right - used across the Spec Test flow for a consistent header.
 *  Pass `dense` on a page that must fit one viewport with no scroll (the Spec Test
 *  landing screen) to shrink the header's own padding, since it eats into that
 *  budget too. */
export function PublicHeader({
  minimal = false,
  badge,
  dense = false,
}: { minimal?: boolean; badge?: React.ReactNode; dense?: boolean } = {}) {
  return (
    <header
      className={cn(
        "flex items-center px-4 sm:px-8",
        dense ? "py-3 sm:py-4" : "py-5",
        minimal && !badge ? "justify-center" : "justify-between",
      )}
    >
      <Link href="/landing" className="flex min-h-11 items-center gap-2">
        <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg">
          <BrandLogo className="h-full w-full" priority alt="" />
        </span>
        <span className="font-brand text-lg font-bold text-primary">
          udala
        </span>
      </Link>
      {minimal
        ? badge
        : (
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        )}
    </header>
  );
}
