"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    getProviders().then((providers) => {
      if (active) setAvailable(Boolean(providers?.google));
    });
    return () => {
      active = false;
    };
  }, []);

  if (!available) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => signIn("google", { callbackUrl: "/" })}
      >
        Continue with Google
      </Button>
    </div>
  );
}
