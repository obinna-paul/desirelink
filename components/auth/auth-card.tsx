import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <Link
          href="/landing"
          className="mx-auto mb-8 block h-28 w-28 overflow-hidden rounded-2xl"
          aria-label="udala"
        >
          <BrandLogo className="h-full w-full" priority alt="" />
        </Link>
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-lg">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-col gap-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
