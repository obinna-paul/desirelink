import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowRight, Check, ChevronDown } from "lucide-react";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/ui/share-button";
import { EmailCaptureForm } from "@/components/spec-test/email-capture-form";
import { AgeBadge } from "@/components/spec-test/age-badge";
import { MatchPriorityPicker } from "@/components/spec-test/match-priority-picker";
import { authOptions } from "@/lib/auth";
import { normalizeMatchPriority, type MatchPriorityValue } from "@/lib/match-priority";
import { prisma } from "@/lib/prisma";
import { getSpecTestReading } from "@/lib/spec-test";
import type { ArchetypeKey, Gender } from "@/lib/spec-test";
import { publicPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

// Legacy rows (predating the gender question, or a v1 row it was never asked on) have no
// stored target - fall back to the routing rule's original default rather than leaving the
// portrait/pronoun unresolved (docs/spec-test-gender-report.md §9).
const DEFAULT_TARGET_GENDER: Gender = "female";

function portraitSrcFor(archetype: ArchetypeKey, target: Gender | null): string {
  const slug = archetype.replace(/_/g, "-");
  return `/images/spec-portraits/${slug}-${target ?? DEFAULT_TARGET_GENDER}.png`;
}

function personWordFor(target: Gender | null): "woman" | "man" {
  return (target ?? DEFAULT_TARGET_GENDER) === "male" ? "man" : "woman";
}

// "Affectionate, emotionally available and reassuring." -> "You like a woman who is
// affectionate, emotionally available and reassuring."
function likePrompt(tagline: string, target: Gender | null): string {
  const lowered = tagline.charAt(0).toLowerCase() + tagline.slice(1);
  return `You like a ${personWordFor(target)} who is ${lowered}`;
}

/**
 * Renders both instrument versions from one page (docs/spec-test-v2-implementation-plan.md
 * §10): a v1 row gets its original five-section reading plus a CTA to take the new
 * instrument (open decision D-4 - a v1 result can never be rescored, so it keeps its own
 * reading rather than being forced into a v2 shape it wasn't computed for). A v2 row gets
 * the fuller ten-section structure the report's §10 result-page spec describes, built from
 * lib/spec-test/interpretation/compose.ts's output.
 */

// One distinct accent per archetype so each result reads as its own identity rather than the
// same gray card with different words - confined to small elements (badge, quote), never the
// page shell. Both v1 and v2 rows resolve to the same eight archetype keys.
const SPEC_ACCENTS: Record<ArchetypeKey, { badge: string }> = {
  quiet_fire: { badge: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  soft_landing: { badge: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  electric_charmer: { badge: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300" },
  ambitious_icon: { badge: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  brilliant_tease: { badge: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  beautiful_mystery: { badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  free_spirit: { badge: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  grounded_equal: { badge: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
};

const RESULT_DISCLAIMER =
  "This is a research-informed reflection on your attraction preferences, not a diagnosis or a prediction of destiny. People and relationships change with context. Use the reading as a prompt to notice patterns, not as a reason to ignore what someone consistently shows you.";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const reading = await getSpecTestReading(params.id);
  if (!reading) {
    return publicPageMetadata({
      title: "The Spec Test",
      description: "Find out your spec on Udala.",
      path: `/spec-test/result/${params.id}`,
    });
  }

  const { name, tagline } =
    reading.version === "v1" ? reading.reading : reading.copy.headline;

  return publicPageMetadata({
    title: `My spec is ${name} | The Spec Test`,
    description: tagline,
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

function ResultHeader({
  eyebrow,
  name,
  tagline,
  accent,
  portraitSrc,
  portraitAlt,
}: {
  eyebrow: string;
  name: string;
  tagline: string;
  accent: { badge: string };
  portraitSrc: string;
  portraitAlt: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
      <p className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", accent.badge)}>{eyebrow}</p>
      <Image
        src={portraitSrc}
        alt={portraitAlt}
        width={160}
        height={200}
        className="h-40 w-32 rounded-2xl object-cover shadow-card sm:h-48 sm:w-40"
        priority
      />
      <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>
      <p className="text-base text-muted-foreground">{tagline}</p>
    </div>
  );
}

// Gates the full reading behind a click so a taker always sees the header + teaser first -
// the join CTA stays outside this, in the page body, so it's never hidden by a collapsed
// disclosure.
function LearnMoreDisclosure({ children }: { children: React.ReactNode }) {
  return (
    <details className="group flex flex-col gap-10 [&::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-border/60 bg-card px-5 py-3 text-sm font-semibold text-foreground shadow-card transition-colors hover:bg-muted/60">
        Learn more about your spec
        <ChevronDown className="h-4 w-4 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-10">{children}</div>
    </details>
  );
}

// A signed-in taker's result is already linked to their account the moment they submitted
// it (see app/api/spec-test/submit/route.ts's viewerProfileId) - no email step needed, and
// "Join Udala" would be a strange thing to say to someone already a member. They get a
// plain confirmation and a way back into the app instead. Either way, the share action always
// invites a friend to take the quiz themselves (href points at /spec-test, the quiz's own
// landing page, never this taker's personal result) - not "share my result," since a result
// is a private reading about the taker, not something meant to circulate on its own.
function JoinCta({
  resultId,
  specName,
  isSignedIn,
  matchPriority,
}: {
  resultId: string;
  specName: string;
  isSignedIn: boolean;
  matchPriority: MatchPriorityValue;
}) {
  const inviteShare = (
    <ShareButton
      href="/spec-test"
      title={`I got ${specName} on the Spec Test. Take it and see what you get.`}
      label="Invite a friend to take it"
      variant="ghost"
      className="text-muted-foreground"
    />
  );

  if (isSignedIn) {
    return (
      <>
        <RevealSection delayMs={680}>
          <MatchPriorityPicker initialPriority={matchPriority} />
        </RevealSection>
        <RevealSection delayMs={720} className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card p-6 text-center shadow-card">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Check className="h-4 w-4 text-primary" aria-hidden="true" />
            Saved to your profile - find it anytime under Profile settings.
          </p>
          <Button
            asChild
            className="h-14 w-full max-w-sm gap-2 rounded-full bg-gradient-to-r from-primary to-neon-pink text-base font-bold shadow-lift transition-transform hover:scale-[1.02] hover:opacity-95 active:scale-[0.99]"
          >
            <Link href="/">
              Back to Udala
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
          {inviteShare}
        </RevealSection>
      </>
    );
  }

  return (
    <RevealSection delayMs={700} className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card p-6 text-center shadow-card">
      <p className="font-heading text-xl font-bold">Meet people who match your energy on Udala.</p>
      <Button
        asChild
        className="h-14 w-full max-w-sm gap-2 rounded-full bg-gradient-to-r from-primary to-neon-pink text-base font-bold shadow-lift transition-transform hover:scale-[1.02] hover:opacity-95 active:scale-[0.99]"
      >
        <Link href="/signup">
          Join Udala
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </Button>
      {inviteShare}

      <div className="mt-2 w-full max-w-sm border-t border-border/60 pt-6">
        <p className="mb-3 text-sm font-medium">Want a copy of this in your inbox?</p>
        <EmailCaptureForm resultId={resultId} />
      </div>
    </RevealSection>
  );
}

export default async function SpecTestResultPage({ params }: { params: { id: string } }) {
  const [reading, session] = await Promise.all([getSpecTestReading(params.id), getServerSession(authOptions)]);
  if (!reading) notFound();
  const isSignedIn = Boolean(session?.user?.id);
  const profile = session?.user?.id
    ? await prisma.profile.findUnique({
        where: { userId: session.user.id },
        select: { matchPriority: true },
      })
    : null;
  const matchPriority = normalizeMatchPriority(profile?.matchPriority);

  if (reading.version === "v1") {
    const { reading: v1 } = reading;
    const specType = reading.specType as ArchetypeKey;
    const accent = SPEC_ACCENTS[specType];
    const target = reading.assumedAttractionTarget;

    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader minimal badge={<AgeBadge />} />

        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12 sm:px-8">
          <p className="rounded-2xl border border-dashed border-border/60 bg-card px-4 py-3 text-center text-xs text-muted-foreground">
            You took an earlier version of the Spec Test.{" "}
            <Link href="/spec-test" className="font-medium text-primary underline underline-offset-4">
              Take the new one
            </Link>{" "}
            for a deeper, more personal read.
          </p>

          <ResultHeader
            eyebrow="Your spec is"
            name={v1.name}
            tagline={likePrompt(v1.tagline, target)}
            accent={accent}
            portraitSrc={portraitSrcFor(specType, target)}
            portraitAlt={`${v1.name} spec portrait`}
          />

          <LearnMoreDisclosure>
            <RevealSection delayMs={80}>
              <p className="text-[15px] leading-relaxed">{v1.intro}</p>
            </RevealSection>

            <RevealSection delayMs={140} className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-semibold">What your spec says about you</h2>
              {v1.whatItSaysAboutYou.map((paragraph, index) => (
                <p key={index} className="text-[15px] leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </RevealSection>

            <RevealSection delayMs={200} className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-semibold">Your dating pattern</h2>
              {v1.datingPattern.map((paragraph, index) => (
                <p key={index} className="text-[15px] leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </RevealSection>

            <RevealSection delayMs={260} className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-semibold">Your blind spot</h2>
              {v1.blindSpot.map((paragraph, index) => (
                <p key={index} className="text-[15px] leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </RevealSection>

            <RevealSection delayMs={320} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
              <h2 className="font-heading text-lg font-semibold">What actually works for you</h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{v1.whatWorksForYou}</p>
              <p className="font-heading text-[15px] font-semibold italic">&ldquo;{v1.attractionTruth}&rdquo;</p>
            </RevealSection>
          </LearnMoreDisclosure>

          <JoinCta resultId={params.id} specName={v1.name} isSignedIn={isSignedIn} matchPriority={matchPriority} />
        </main>

        <PublicFooter />
      </div>
    );
  }

  // v2
  const { copy } = reading;
  const accent = SPEC_ACCENTS[copy.primarySpec];
  const target = reading.assumedAttractionTarget;

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader minimal badge={<AgeBadge />} />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12 sm:px-8">
        {/* 1. Your Spec */}
        <ResultHeader
          eyebrow="Your spec is"
          name={copy.headline.name}
          tagline={likePrompt(copy.headline.tagline, target)}
          accent={accent}
          portraitSrc={portraitSrcFor(copy.primarySpec, target)}
          portraitAlt={`${copy.headline.name} spec portrait`}
        />

        <LearnMoreDisclosure>
          {/* 2. Why this pulls you in - the archetype hook, plus the taker's own top 3 motive
               signals (not fixed archetype copy - these come straight from their scores). */}
          <RevealSection delayMs={80} className="flex flex-col gap-4">
            <p className="text-[15px] leading-relaxed">{copy.corePull}</p>
            <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border/60 bg-card/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your top signals</p>
              <ul className="flex flex-col gap-2">
                {copy.topMotives.map((signal) => (
                  <li key={signal.key} className="text-[15px] leading-relaxed text-muted-foreground">
                    {signal.copy}
                  </li>
                ))}
              </ul>
            </div>
          </RevealSection>

          {/* 3. The twist - report §10: "secondary Spec OR Spark-Partnership split", never both.
               Showing both at once was naming up to three archetypes in one card with no
               explanation attached to the newer two - confirmed confusing in practice. */}
          <RevealSection delayMs={140} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h2 className="font-heading text-lg font-semibold">The twist</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {copy.sparkPartnershipTwist ? copy.sparkPartnershipTwist.copy : copy.secondaryInfluence}
            </p>
          </RevealSection>

          {/* 4. What it says about you */}
          <RevealSection delayMs={200} className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold">What it says about you</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{copy.whatItSaysAboutYou}</p>
          </RevealSection>

          {/* 5. Something you might not know about yourself - the taker's single most extreme
               interpretive lens (report §3 Layer B), a pattern pulled across several answers
               rather than a recap of any one of them. Always present. */}
          <RevealSection delayMs={260} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h2 className="font-heading text-lg font-semibold">Something you might not know about yourself</h2>
            <p className="text-sm font-semibold text-primary">{copy.lensInsight.title}</p>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{copy.lensInsight.copy}</p>
          </RevealSection>

          {/* 6. How you handle uncertainty - the taker's attachment-response read, in ordinary
               language only (report §9: never a diagnosis). Absent only when no attachment item
               was ever answered. */}
          {copy.attachmentInsight && (
            <RevealSection delayMs={320} className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-semibold">How you handle uncertainty</h2>
              <p className="text-sm font-semibold text-primary">{copy.attachmentInsight.title}</p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{copy.attachmentInsight.copy}</p>
            </RevealSection>
          )}

          {/* 7. Your likely dating loop - only the modules that actually converged */}
          {copy.datingLoop.length > 0 && (
            <RevealSection delayMs={380} className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-semibold">Your likely dating loop</h2>
              {copy.datingLoop.map((flag) => (
                <p key={flag.id} className="text-[15px] leading-relaxed text-muted-foreground">
                  {flag.copy}
                </p>
              ))}
            </RevealSection>
          )}

          {/* 8. Your strength in love */}
          <RevealSection delayMs={440} className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold">Your strength in love</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{copy.strength}</p>
          </RevealSection>

          {/* 9. Your blind spot */}
          <RevealSection delayMs={500} className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold">Your blind spot</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{copy.blindSpot}</p>
          </RevealSection>

          {/* 10. Who tends to work for you - the archetype's own partner brief, plus a second,
               trait-based partner note from the same lens insight above, so the brief draws on
               more than one signal (report §7 "person to marry": a behavioral brief, not a type
               label). */}
          <RevealSection delayMs={560} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h2 className="font-heading text-lg font-semibold">Who tends to work for you</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{copy.longTermFit}</p>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{copy.lensInsight.partnerNote}</p>
          </RevealSection>

          {/* 11. One experiment */}
          <RevealSection delayMs={620} className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold">One thing to try</h2>
            <p className="font-heading text-[15px] font-semibold italic text-foreground">&ldquo;{copy.growthPrompt}&rdquo;</p>
          </RevealSection>

          <RevealSection delayMs={640} className="flex flex-col gap-1 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.confidenceLabel}</p>
            <p className="text-xs text-muted-foreground/80">{RESULT_DISCLAIMER}</p>
          </RevealSection>
        </LearnMoreDisclosure>

        {/* 12. Join / back-to-app card, with an invite-a-friend share action */}
        <JoinCta resultId={params.id} specName={copy.headline.name} isSignedIn={isSignedIn} matchPriority={matchPriority} />
      </main>

      <PublicFooter />
    </div>
  );
}
