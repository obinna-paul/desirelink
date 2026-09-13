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
  "You have a type, even if you can't describe it. Answer 10 carefully designed questions to uncover the traits, energy and little behaviours you're naturally drawn to.";

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
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden px-6 pt-[clamp(1.75rem,4.8dvh,2.2rem)] sm:px-8">
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

        <p
          className="mt-[clamp(0.75rem,2.6dvh,1.2rem)] text-center text-[clamp(0.8rem,1.9dvh,0.9rem)] leading-snug text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
          style={{ animationDelay: "200ms" }}
        >
          Answer 10 carefully designed questions to uncover the traits, energy and little
          behaviours you&apos;re naturally drawn to&mdash;and what they reveal about you.
        </p>

        <Button
          asChild
          className="mt-[clamp(1rem,3.5dvh,1.6rem)] h-[clamp(2.5rem,7.3dvh,3.35rem)] w-full gap-2 rounded-full text-[clamp(0.7rem,1.7dvh,0.8rem)] font-bold uppercase tracking-[0.1em] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
          style={{ animationDelay: "260ms" }}
        >
          <Link href="/spec-test/quiz">
            Discover My Spec
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>

        <p
          className="mt-[clamp(0.6rem,2.1dvh,1rem)] text-center text-[clamp(0.7rem,1.6dvh,0.75rem)] text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
          style={{ animationDelay: "320ms" }}
        >
          Free &middot; Private &middot; About 4 minutes
        </p>

        <div className="mt-[clamp(1rem,3.5dvh,1.6rem)] border-t border-border/60 pt-[clamp(0.5rem,2.2dvh,1rem)] text-center">
          <p className="text-[clamp(0.7rem,1.6dvh,0.75rem)] text-muted-foreground">
            A playful, research-informed reading of your attraction pattern.
          </p>
        </div>
      </main>
    </div>
  );
}
