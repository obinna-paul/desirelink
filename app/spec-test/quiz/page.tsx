import type { Metadata } from "next";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { SpecTestQuizFlow } from "@/components/spec-test/quiz-flow";
import { AgeBadge } from "@/components/spec-test/age-badge";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "The Spec Test | Udala",
  description: "Answer a few quick questions and we'll guess your spec.",
  path: "/spec-test/quiz",
});

export default function SpecTestQuizPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader minimal badge={<AgeBadge />} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-8">
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
          <SpecTestQuizFlow />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
