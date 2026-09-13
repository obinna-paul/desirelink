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

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-2.5 overflow-hidden px-5 py-1 sm:gap-4 sm:px-8">
        <p className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
          The Spec Test
        </p>

        <h1
          className="font-heading text-[1.65rem] font-semibold leading-[1.12] tracking-tight text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 sm:text-5xl"
          style={{ animationDelay: "60ms" }}
        >
          You have <em className="italic text-primary">a type.</em> Even if you can&apos;t
          describe it.
        </h1>

        <div
          className="flex justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 motion-safe:duration-700"
          style={{ animationDelay: "140ms" }}
        >
          <Image
            src="/images/spec-test-fingerprint.png"
            alt=""
            width={260}
            height={260}
            priority
            className="h-24 w-24 sm:h-40 sm:w-40"
          />
        </div>

        <p
          className="text-center text-[13px] leading-snug text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 sm:text-base sm:leading-relaxed"
          style={{ animationDelay: "200ms" }}
        >
          Answer 10 carefully designed questions to uncover the traits, energy and little
          behaviours you&apos;re naturally drawn to&mdash;and what they reveal about you.
        </p>

        <Button
          asChild
          className="h-11 w-full gap-2 rounded-full text-xs font-bold uppercase tracking-[0.1em] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 sm:h-14 sm:text-sm"
          style={{ animationDelay: "260ms" }}
        >
          <Link href="/spec-test/quiz">
            Discover My Spec
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>

        <p
          className="text-center text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
          style={{ animationDelay: "320ms" }}
        >
          Free &middot; Private &middot; About 4 minutes
        </p>

        <div className="border-t border-border/60 pt-2.5 text-center sm:pt-4">
          <p className="text-xs text-muted-foreground">
            A playful, research-informed reading of your attraction pattern.
          </p>
        </div>
      </main>
    </div>
  );
}
