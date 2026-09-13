import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/ui/share-button";
import { EmailCaptureForm } from "@/components/spec-test/email-capture-form";
import { prisma } from "@/lib/prisma";
import { SPEC_TYPE_READINGS, type SpecTypeKey } from "@/lib/spec-test";
import { publicPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

// One distinct accent per archetype so each result reads as its own identity rather
// than the same gray card with different words - confined to small elements (badge,
// icon, quote) per the "keep the page background white" direction, never the page shell.
const SPEC_ACCENTS: Record<SpecTypeKey, { badge: string; icon: string }> = {
  quiet_fire: { badge: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300", icon: "text-red-600 dark:text-red-400" },
  soft_landing: { badge: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", icon: "text-rose-600 dark:text-rose-400" },
  electric_charmer: { badge: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300", icon: "text-fuchsia-600 dark:text-fuchsia-400" },
  ambitious_icon: { badge: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", icon: "text-amber-600 dark:text-amber-400" },
  brilliant_tease: { badge: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", icon: "text-violet-600 dark:text-violet-400" },
  beautiful_mystery: { badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", icon: "text-indigo-600 dark:text-indigo-400" },
  free_spirit: { badge: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", icon: "text-orange-600 dark:text-orange-400" },
  grounded_equal: { badge: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", icon: "text-teal-600 dark:text-teal-400" },
};

async function getResult(id: string) {
  const result = await prisma.specTestResult.findUnique({ where: { id }, select: { specType: true } });
  if (!result) return null;
  const specType = result.specType as SpecTypeKey;
  const reading = SPEC_TYPE_READINGS[specType];
  return reading ? { reading, accent: SPEC_ACCENTS[specType] } : null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const data = await getResult(params.id);
  if (!data) {
    return publicPageMetadata({
      title: "The Spec Test | Udala",
      description: "Find out your spec on Udala.",
      path: `/spec-test/result/${params.id}`,
    });
  }

  return publicPageMetadata({
    title: `My spec is ${data.reading.name} | The Spec Test`,
    description: data.reading.tagline,
    path: `/spec-test/result/${params.id}`,
  });
}

// Small, staggered on-load reveal for each section, rather than dumping the whole
// reading at once - kept simple (mount-time stagger, not scroll-triggered) since the
// result page is reached via a fresh navigation right after finishing the quiz, which
// is already the moment worth animating.
function RevealSection({ delayMs, className, children }: { delayMs: number; className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn("motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both", className)}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {children}
    </section>
  );
}

export default async function SpecTestResultPage({ params }: { params: { id: string } }) {
  const data = await getResult(params.id);
  if (!data) notFound();
  const { reading, accent } = data;

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader minimal />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12 sm:px-8">
        <div className="flex flex-col items-center gap-3 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
          <span className={cn("flex h-16 w-16 items-center justify-center rounded-full", accent.badge)}>
            <Sparkles className={cn("h-8 w-8", accent.icon)} aria-hidden="true" />
          </span>
          <p className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", accent.badge)}>
            Your spec is
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{reading.name}</h1>
          <p className="text-base text-muted-foreground">{reading.tagline}</p>
        </div>

        <RevealSection delayMs={80}>
          <p className="text-[15px] leading-relaxed">{reading.intro}</p>
        </RevealSection>

        <RevealSection delayMs={140} className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">What your spec says about you</h2>
          {reading.whatItSaysAboutYou.map((paragraph, index) => (
            <p key={index} className="text-[15px] leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </RevealSection>

        <RevealSection delayMs={200} className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">Your dating pattern</h2>
          {reading.datingPattern.map((paragraph, index) => (
            <p key={index} className="text-[15px] leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </RevealSection>

        <RevealSection delayMs={260} className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">Your blind spot</h2>
          {reading.blindSpot.map((paragraph, index) => (
            <p key={index} className="text-[15px] leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </RevealSection>

        <RevealSection delayMs={320} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">What actually works for you</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{reading.whatWorksForYou}</p>
          <p className="font-heading text-[15px] font-semibold italic">&ldquo;{reading.attractionTruth}&rdquo;</p>
        </RevealSection>

        <RevealSection
          delayMs={380}
          className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center"
        >
          <p className="font-heading text-xl font-bold">Meet people who match your energy on Udala.</p>
          <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="flex-1">
              <Link href="/signup">Join Udala</Link>
            </Button>
            <ShareButton
              href={`/spec-test/result/${params.id}`}
              title={`My spec is ${reading.name} - find yours on Udala.`}
              label="Share my spec"
              variant="outline"
              size="default"
              className="h-12 flex-1 text-[15px]"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Send this to someone who thinks they already know your spec.
          </p>

          <div className="mt-2 w-full max-w-sm border-t border-border/60 pt-6">
            <p className="mb-3 text-sm font-medium">Want a copy of this in your inbox?</p>
            <EmailCaptureForm resultId={params.id} />
          </div>
        </RevealSection>
      </main>

      <PublicFooter />
    </div>
  );
}
