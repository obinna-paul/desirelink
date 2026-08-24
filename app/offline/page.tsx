import Link from "next/link";
import { WifiOff } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12 text-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-5">
        <div className="h-24 w-24 overflow-hidden rounded-2xl">
          <BrandLogo className="h-full w-full" priority />
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <WifiOff className="h-6 w-6 text-neon-cyan" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">You are offline</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Udala saved the app shell, but this page needs a connection to refresh live content.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Try home again</Link>
        </Button>
      </div>
    </main>
  );
}
