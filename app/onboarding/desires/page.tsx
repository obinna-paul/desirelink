import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    <main className="min-h-screen bg-[#f7f1f4] px-4 py-5 text-[#1b141b] sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-3" aria-label="Udala">
            <Image
              src="/udala-logo-light.png"
              alt="Udala"
              width={500}
              height={500}
              priority
              className="h-12 w-12 object-contain"
            />
            <span className="font-heading text-xl font-semibold tracking-tight text-[#211720]">Udala</span>
          </Link>
          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#8f285d] underline-offset-4 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Skip
          </Link>
        </header>

        <section className="grid flex-1 items-start gap-6 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10 lg:py-14">
          <aside className="flex flex-col gap-5 lg:sticky lg:top-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a4962]">
                Onboarding
              </p>
              <h1 className="mt-3 max-w-[10ch] font-heading text-3xl font-semibold leading-tight tracking-tight text-[#171017] sm:text-5xl">
                Build your Desire Map.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#675965] sm:text-base sm:leading-7">
                Choose what you are looking for, what you regularly enjoy, and what stays private. This powers matching without exposing more than you choose.
              </p>
            </div>

            <div className="rounded-2xl border border-[#e0d2da] bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#8f285d]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-[#211720]">Private until you decide</p>
                  <p className="mt-1 text-xs leading-5 text-[#756771]">
                    Every desire starts with privacy controls. You can edit visibility later from your profile.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="rounded-2xl border border-[#e0d2da] bg-white p-4 shadow-[0_24px_70px_rgba(41,22,34,0.1)] sm:p-6">
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
