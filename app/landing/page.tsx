import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        <span className="bg-gradient-to-r from-neon-pink to-neon-cyan bg-clip-text text-transparent">
          DesireLink
        </span>
      </h1>
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
