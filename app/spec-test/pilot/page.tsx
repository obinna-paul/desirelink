import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { AgeBadge } from "@/components/spec-test/age-badge";
import { SpecTestPilotFlow } from "@/components/spec-test/pilot/pilot-flow";
import { isV3PilotEnabled } from "@/lib/spec-test/pilot-v3-feature";

export const metadata: Metadata = {
  title: "Spec Test Research Pilot",
  robots: { index: false, follow: false },
};

export default function SpecTestPilotPage() {
  if (!isV3PilotEnabled()) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader minimal badge={<AgeBadge />} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-8">
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-card sm:p-8">
          <SpecTestPilotFlow />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
