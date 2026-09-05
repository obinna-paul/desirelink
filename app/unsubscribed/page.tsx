import type { Metadata } from "next";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

export const metadata: Metadata = {
  title: "Unsubscribed — udala",
};

export default function UnsubscribedPage({ searchParams }: { searchParams: { ok?: string } }) {
  const ok = searchParams.ok !== "0";

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {ok ? "You're unsubscribed" : "That link didn't work"}
        </h1>
        <p className="text-muted-foreground">
          {ok
            ? "You won't get digest, win-back, or earnings summary emails from Udala anymore. Account and billing emails still send, since those aren't optional."
            : "This unsubscribe link is invalid or expired. Reach out to help@udala.pro and we'll take care of it."}
        </p>
      </main>

      <PublicFooter />
    </div>
  );
}
