"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function GoogleSignInButton({ variant = "default" }: { variant?: "default" | "auth" | "lightAuth" }) {
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
  const isAuth = variant === "auth";
  const isLightAuth = variant === "lightAuth";

  return (
    <div className="flex flex-col gap-4">
      <div
        className={
          isAuth
            ? "flex items-center gap-3 text-xs text-white/46"
            : "flex items-center gap-3 text-xs text-muted-foreground"
        }
      >
        <span className={isAuth ? "h-px flex-1 bg-white/16" : "h-px flex-1 bg-border"} />
        or
        <span className={isAuth ? "h-px flex-1 bg-white/16" : "h-px flex-1 bg-border"} />
      </div>
      <Button
        type="button"
        variant="outline"
        className={
          isAuth
            ? "h-12 rounded-lg border-white/12 bg-white/[0.055] text-white hover:border-white/28 hover:bg-white/[0.09]"
            : isLightAuth
              ? "h-12 rounded-lg border-[#16a34a] bg-[#16a34a] text-white shadow-[0_14px_30px_rgba(22,163,74,0.2)] hover:border-[#12833d] hover:bg-[#12833d]"
              : undefined
        }
        onClick={() => signIn("google", { callbackUrl: "/" })}
      >
        Continue with Google
      </Button>
    </div>
  );
}
