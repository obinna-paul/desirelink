import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function PublicHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-5 sm:px-8">
      <Link href="/landing" className="flex min-h-11 items-center gap-2">
        <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg">
          <BrandLogo className="h-full w-full" priority alt="" />
        </span>
        <span className="font-brand text-lg font-bold text-primary">
          udala
        </span>
      </Link>
      <nav className="flex items-center gap-2">
        <ThemeToggle />
        <Button asChild variant="ghost">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Get started</Link>
        </Button>
      </nav>
    </header>
  );
}
