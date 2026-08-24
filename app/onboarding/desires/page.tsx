import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

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
    <div className="flex min-h-screen justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <Link
          href="/landing"
          className="mb-8 block text-center text-2xl font-bold tracking-tight"
        >
          <span className="bg-gradient-to-r from-neon-pink to-neon-cyan bg-clip-text text-transparent">
            Udala
          </span>
        </Link>

        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-lg">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight">Build your Desire Map</h1>
            <p className="text-sm text-muted-foreground">
              Tell us what you&apos;re into. Pick a level for as many categories as you like, and
              choose who gets to see each one. You can change this anytime from your profile.
            </p>
          </div>

          <DesireMapEditor
            initialDesires={profile.desires}
            redirectTo="/profile"
            submitLabel="Save and continue"
            skipHref="/profile"
          />
        </div>
      </div>
    </div>
  );
}
