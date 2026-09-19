import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, Fingerprint } from "lucide-react";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { SpecTestQuizFlow } from "@/components/spec-test/quiz-flow";
import { AgeBadge } from "@/components/spec-test/age-badge";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveRetakeCooldown } from "@/lib/spec-test/retake";
import { V3_INSTRUMENT_VERSION } from "@/lib/spec-test/items/spec-v3";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "The Spec Test",
  description: "Answer a few quick questions and we'll guess your spec.",
  path: "/spec-test/quiz",
});

export default async function SpecTestQuizPage() {
  // Anonymous submissions are never capped (see submit/route.ts and getActiveRetakeCooldown's
  // own doc comment) - this check only ever applies to a signed-in taker, so an anonymous
  // visitor skips straight to the quiz below with no extra query at all.
  const session = await getServerSession(authOptions);
  const viewerProfile = session?.user?.id
    ? await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    : null;
  const cooldown = viewerProfile ? await getActiveRetakeCooldown(viewerProfile.id, V3_INSTRUMENT_VERSION) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader minimal badge={<AgeBadge />} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-8">
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
          {cooldown ? (
            // Checked up front rather than only at submit time: without this, a signed-in
            // taker inside the cooldown would answer all 28 questions before ever being told
            // there's nothing new to score - see submit/route.ts's own 429 for the same check,
            // enforced there as the actual guard.
            <div className="flex flex-col items-center gap-5 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-tint">
                <Fingerprint className="h-5 w-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <h1 className="font-heading text-2xl font-bold sm:text-3xl">You&rsquo;ve already got a recent spec</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  You can retake the Spec Test on{" "}
                  {cooldown.nextEligibleAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Until
                  then, here&rsquo;s your result.
                </p>
              </div>
              <Button asChild size="lg" className="w-full max-w-xs gap-2">
                <Link href={`/spec-test/result/${cooldown.resultId}`}>
                  View your result
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          ) : (
            <SpecTestQuizFlow />
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
