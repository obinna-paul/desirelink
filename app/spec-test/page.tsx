import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { Button } from "@/components/ui/button";
import { publicPageMetadata, serializeJsonLd } from "@/lib/seo";
import { SITE_NAME, absoluteUrl } from "@/lib/site-config";

const PAGE_TITLE = "The Spec Test | Udala";
const PAGE_DESCRIPTION =
  "We'll guess your spec in about four minutes - not just what they look like, but the energy, habits, and personality that pull you in.";

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
    <div className="flex min-h-screen flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-8 px-4 py-16 text-center sm:px-8">
        <Sparkles className="h-12 w-12 text-primary" aria-hidden="true" />

        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-5xl">
            We&apos;ll guess your spec in four minutes.
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Not just what they look like - the energy, habits, and personality that pull you in.
            A playful, research-informed reading of your attraction pattern.
          </p>
        </div>

        <Button asChild size="lg" className="w-full max-w-xs">
          <Link href="/spec-test/quiz">Find My Spec</Link>
        </Button>

        <p className="text-xs text-muted-foreground">
          Free, anonymous, and about 10 quick questions. For adults 18 and over.
        </p>
      </main>

      <PublicFooter />
    </div>
  );
}
