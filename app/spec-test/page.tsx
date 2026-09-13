import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { AgeBadge } from "@/components/spec-test/age-badge";
import { publicPageMetadata, serializeJsonLd } from "@/lib/seo";
import { SITE_NAME, absoluteUrl } from "@/lib/site-config";

const PAGE_TITLE = "The Spec Test | Udala";
const PAGE_DESCRIPTION =
  "You have a type, even if you can't describe it. Answer 24 carefully designed questions to uncover the traits, energy and little behaviours you're naturally drawn to.";

export const metadata: Metadata = publicPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/spec-test",
});

export default function SpecTestLandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: absoluteUrl("/spec-test"),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
  };

  return (
    // Fixed to one dynamic-viewport-height screen with nothing below the fold - this
    // is a single-CTA funnel page, not a scrolling article, so every element below is
    // sized to fit alongside the others rather than assuming it can claim its own
    // screen's worth of space.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f7f4ee] dark:bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <PublicHeader minimal badge={<AgeBadge />} dense />

      {/* Every size/gap below is clamp(min, Xdvh, max) - the dvh term scales it down
          proportionally on a short phone (same logic as before), but the max now caps
          it at the mockup's own absolute size (measured against its ~732px-tall
          reference frame) instead of continuing to grow past that on a taller phone.
          Uncapped dvh values were the bug: on a tall viewport every size and gap grew
          past what the mockup shows, reading as too large and too loosely spaced. */}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden px-8 pt-[clamp(1.75rem,4.8dvh,2.2rem)]">
        <p className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 text-[clamp(0.65rem,1.6dvh,0.72rem)] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          The Spec Test
        </p>

        <h1
          className="mt-[clamp(0.75rem,2.4dvh,1.1rem)] font-heading text-[clamp(1.85rem,5.6dvh,2.6rem)] font-semibold leading-[1.12] tracking-tight text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
          style={{ animationDelay: "60ms" }}
        >
          You have <em className="italic text-primary">a type.</em> Even if you can&apos;t
          describe it.
        </h1>

        <div
          className="mt-[clamp(1rem,4.1dvh,1.9rem)] flex justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 motion-safe:duration-700"
          style={{ animationDelay: "140ms" }}
        >
          <Image
            src="/images/spec-test-fingerprint.png"
            alt=""
            width={260}
            height={260}
            priority
            className="h-[clamp(6rem,22.5dvh,10.3rem)] w-[clamp(6rem,22.5dvh,10.3rem)]"
          />
        </div>

        {/* Narrower than the container (the mockup insets body copy further than its
            edge-to-edge button/headline) so it wraps to the mockup's own 4 lines
            instead of stretching wide and reading as 3. */}
        <p
          className="mt-[clamp(0.75rem,2.6dvh,1.2rem)] px-[1.35rem] text-center text-[clamp(0.8rem,1.9dvh,0.9rem)] leading-snug text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
          style={{ animationDelay: "200ms" }}
        >
          Answer 24 carefully designed questions to uncover the traits, energy and little
          behaviours you&apos;re naturally drawn to&mdash;and what they reveal about you.
        </p>

        {/* Text is centered on its own (not as a text+icon group), with the arrow
            pinned to the button's right padding edge - the mockup spaces the arrow
            well away from the label instead of tucking it right up against it. */}
        <Button
          asChild
          className="mt-[clamp(1rem,3.5dvh,1.6rem)] h-[clamp(3rem,8.3dvh,3.85rem)] w-full rounded-[12px] px-5 text-[clamp(0.7rem,1.7dvh,0.8rem)] font-bold uppercase tracking-[0.1em] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
          style={{ animationDelay: "260ms" }}
        >
          <Link href="/spec-test/quiz" className="relative">
            Discover My Spec
            <ArrowRight className="absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
          </Link>
        </Button>

        <p
          className="mt-[clamp(0.6rem,2.1dvh,1rem)] text-center text-[clamp(0.7rem,1.6dvh,0.75rem)] text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
          style={{ animationDelay: "320ms" }}
        >
          {/* Estimate, not yet measured against real completion times - see
              docs/spec-test-v2-implementation-plan.md open decision D-5. Revisit once Phase 7
              analytics show the real median for the 24-item v2 instrument. */}
          Free &middot; Private &middot; About 5 minutes
        </p>

        <div className="mt-[clamp(1rem,3.5dvh,1.6rem)] border-t border-border/60 pt-[clamp(0.5rem,2.2dvh,1rem)] text-center">
          <p className="text-[clamp(0.7rem,1.6dvh,0.75rem)] text-muted-foreground">
            A playful, research-informed reading of your attraction pattern (beta).
          </p>
        </div>
      </main>
    </div>
  );
}
