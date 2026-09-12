import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/ui/share-button";
import { EmailCaptureForm } from "@/components/spec-test/email-capture-form";
import { prisma } from "@/lib/prisma";
import { SPEC_TYPE_READINGS, type SpecTypeKey } from "@/lib/spec-test";
import { publicPageMetadata } from "@/lib/seo";

async function getResult(id: string) {
  const result = await prisma.specTestResult.findUnique({ where: { id }, select: { specType: true } });
  if (!result) return null;
  const reading = SPEC_TYPE_READINGS[result.specType as SpecTypeKey];
  return reading ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const reading = await getResult(params.id);
  if (!reading) {
    return publicPageMetadata({
      title: "The Spec Test | Udala",
      description: "Find out your spec on Udala.",
      path: `/spec-test/result/${params.id}`,
    });
  }

  return publicPageMetadata({
    title: `My spec is ${reading.name} | The Spec Test`,
    description: reading.tagline,
    path: `/spec-test/result/${params.id}`,
  });
}

export default async function SpecTestResultPage({ params }: { params: { id: string } }) {
  const reading = await getResult(params.id);
  if (!reading) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12 sm:px-8">
        <div className="flex flex-col gap-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your spec is</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{reading.name}</h1>
          <p className="text-base text-muted-foreground">{reading.tagline}</p>
        </div>

        <p className="text-[15px] leading-relaxed">{reading.intro}</p>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">What your spec says about you</h2>
          {reading.whatItSaysAboutYou.map((paragraph, index) => (
            <p key={index} className="text-[15px] leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">Your dating pattern</h2>
          {reading.datingPattern.map((paragraph, index) => (
            <p key={index} className="text-[15px] leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">Your blind spot</h2>
          {reading.blindSpot.map((paragraph, index) => (
            <p key={index} className="text-[15px] leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">What actually works for you</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{reading.whatWorksForYou}</p>
          <p className="font-heading text-[15px] font-semibold italic">&ldquo;{reading.attractionTruth}&rdquo;</p>
        </section>

        <div className="flex flex-col items-center gap-3 border-t border-border/60 pt-8 text-center">
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

          <div className="mt-4 w-full max-w-sm border-t border-border/60 pt-6">
            <p className="mb-3 text-sm font-medium">Want a copy of this in your inbox?</p>
            <EmailCaptureForm resultId={params.id} />
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
