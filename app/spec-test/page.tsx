import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
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
    <div className="flex min-h-screen flex-col bg-[#f7f4ee] dark:bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <PublicHeader minimal badge={<AgeBadge />} />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
        <p className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          The Spec Test
        </p>

        <h1
          className="font-heading text-4xl font-semibold leading-[1.1] tracking-tight text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 sm:text-6xl"
          style={{ animationDelay: "60ms" }}
        >
          You have <em className="italic text-primary">a type.</em> Even if you can&apos;t
          describe it.
        </h1>

        <div
          className="flex justify-center py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 motion-safe:duration-700"
          style={{ animationDelay: "140ms" }}
        >
          <Image
            src="/images/spec-test-fingerprint.png"
            alt=""
            width={260}
            height={260}
            priority
            className="h-56 w-56 sm:h-64 sm:w-64"
          />
        </div>

        <p
          className="text-center text-base leading-relaxed text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
          style={{ animationDelay: "200ms" }}
        >
          Answer 10 carefully designed questions to uncover the traits, energy and little
          behaviours you&apos;re naturally drawn to&mdash;and what they reveal about you.
        </p>

        <Button
          asChild
          className="h-14 w-full gap-2 rounded-full text-sm font-bold uppercase tracking-[0.1em] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
          style={{ animationDelay: "260ms" }}
        >
          <Link href="/spec-test/quiz">
            Discover My Spec
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>

        <p
          className="text-center text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
          style={{ animationDelay: "320ms" }}
        >
          Free &middot; Private &middot; About 4 minutes
        </p>

        <div className="border-t border-border/60 pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            A playful, research-informed reading of your attraction pattern.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
