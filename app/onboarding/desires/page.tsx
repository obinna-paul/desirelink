import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrandLogo } from "@/components/brand-logo";
import { DesireMapEditor } from "@/components/desires/desire-map-editor";

export default async function DesireOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: { desires: true },
  });

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="dark min-h-screen overflow-hidden bg-background px-4 py-5 text-foreground sm:px-8 sm:py-8">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_25%_0%,hsl(335_74%_68%/0.18),transparent_34%),radial-gradient(circle_at_88%_16%,hsl(276_72%_55%/0.2),transparent_28%)]"
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-3" aria-label="Udala">
            <span className="flex h-11 w-11 overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/15">
              <BrandLogo className="h-full w-full" priority alt="" />
            </span>
            <span className="font-heading text-xl font-semibold tracking-tight">Udala</span>
          </Link>
          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Skip
          </Link>
        </header>

        <section className="grid flex-1 items-start gap-6 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10 lg:py-14">
          <aside className="flex flex-col gap-5 lg:sticky lg:top-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neon-pink">
                Onboarding
              </p>
              <h1 className="mt-3 font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Build your Desire Map.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                Choose what you are looking for, what you regularly enjoy, and what stays private. This powers matching without exposing more than you choose.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-card backdrop-blur">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neon-pink" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Private until you decide</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Every desire starts with privacy controls. You can edit visibility later from your profile.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="rounded-2xl border border-border/60 bg-card/82 p-4 shadow-lift backdrop-blur sm:p-6">
            <DesireMapEditor
              initialDesires={profile.desires}
              redirectTo="/profile"
              submitLabel="Save and continue"
              skipHref="/profile"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
