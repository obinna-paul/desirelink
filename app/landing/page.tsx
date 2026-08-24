import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="sr-only">Udala</h1>
      <div className="h-56 w-56 overflow-hidden rounded-3xl sm:h-64 sm:w-64">
        <BrandLogo className="h-full w-full" priority />
      </div>
      <h2 className="text-4xl font-bold tracking-tight">
        Meet people with intention
      </h2>
      <p className="max-w-md text-muted-foreground">
        A real-time social marketplace connecting people, creators, communities, and
        offline experiences.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/signup">Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </div>
  );
}
