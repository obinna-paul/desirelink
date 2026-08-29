import Link from "next/link";
import Image from "next/image";

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
          className="mx-auto mb-8 flex h-16 w-fit items-center justify-center"
          aria-label="udala"
        >
          <Image
            src="/udala-logo-light.png"
            alt="Udala"
            width={500}
            height={500}
            priority
            className="h-14 w-14 object-contain"
          />
          <span className="ml-3 font-heading text-xl font-semibold tracking-tight">udala</span>
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
