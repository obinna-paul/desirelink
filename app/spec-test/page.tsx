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

      {/* Every size/gap below is a percentage of viewport height (dvh), lifted directly
          from the approved mockup's own proportions (measured against its ~732px-tall
          reference frame) - not centered as a small block with dead space around it,
          but laid out top-down the same way the mockup is, so it fills the screen the
          same way on a short phone as on a tall one. */}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden px-6 pt-[4.8dvh] sm:px-8">
        <p className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 text-[clamp(0.65rem,1.6dvh,0.8rem)] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          The Spec Test
        </p>

        <h1
          className="mt-[2.4dvh] font-heading text-[clamp(1.85rem,5.6dvh,3.25rem)] font-semibold leading-[1.12] tracking-tight text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
          style={{ animationDelay: "60ms" }}
        >
          You have <em className="italic text-primary">a type.</em> Even if you can&apos;t
          describe it.
        </h1>

        <div
          className="mt-[4.1dvh] flex justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 motion-safe:duration-700"
          style={{ animationDelay: "140ms" }}
        >
          <Image
            src="/images/spec-test-fingerprint.png"
            alt=""
            width={260}
            height={260}
            priority
            className="h-[clamp(6rem,22.5dvh,12rem)] w-[clamp(6rem,22.5dvh,12rem)]"
          />
        </div>

        <p
          className="mt-[2.6dvh] text-center text-[clamp(0.85rem,1.9dvh,1.05rem)] leading-snug text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
          style={{ animationDelay: "200ms" }}
        >
          Answer 10 carefully designed questions to uncover the traits, energy and little
          behaviours you&apos;re naturally drawn to&mdash;and what they reveal about you.
        </p>

        <Button
          asChild
          className="mt-[3.5dvh] h-[clamp(2.75rem,7.3dvh,3.5rem)] w-full gap-2 rounded-full text-[clamp(0.75rem,1.7dvh,0.9rem)] font-bold uppercase tracking-[0.1em] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
          style={{ animationDelay: "260ms" }}
        >
          <Link href="/spec-test/quiz">
            Discover My Spec
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>

        <p
          className="mt-[2.1dvh] text-center text-[clamp(0.75rem,1.6dvh,0.875rem)] text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
          style={{ animationDelay: "320ms" }}
        >
          Free &middot; Private &middot; About 4 minutes
        </p>

        <div className="mt-[3.5dvh] border-t border-border/60 pt-[2.2dvh] text-center">
          <p className="text-[clamp(0.75rem,1.6dvh,0.875rem)] text-muted-foreground">
            A playful, research-informed reading of your attraction pattern.
          </p>
        </div>
      </main>
    </div>
  );
}
