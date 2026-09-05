"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OAuthProviderId = "google" | "twitter";

const PROVIDER_ORDER: OAuthProviderId[] = ["google", "twitter"];
const PROVIDER_LABELS: Record<OAuthProviderId, string> = {
  google: "Continue with Google",
  twitter: "Continue with X",
};

export function OAuthSignInButtons({ variant = "default" }: { variant?: "default" | "auth" | "lightAuth" }) {
  const [available, setAvailable] = useState<OAuthProviderId[]>([]);

  useEffect(() => {
    let active = true;
    getProviders().then((providers) => {
      if (!active || !providers) return;
      setAvailable(PROVIDER_ORDER.filter((id) => id in providers));
    });
    return () => {
      active = false;
    };
  }, []);

  if (available.length === 0) return null;
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
      <div className="flex flex-col gap-3">
        {available.map((id) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            className={cn(
              isAuth &&
                "h-12 rounded-lg border-white/12 bg-white/[0.055] text-white hover:border-white/28 hover:bg-white/[0.09]",
              isLightAuth &&
                id === "google" &&
                "h-[52px] rounded-xl border-[#16a34a] bg-[#16a34a] text-base text-white shadow-[0_14px_30px_rgba(22,163,74,0.2)] hover:border-[#12833d] hover:bg-[#12833d] sm:h-12 sm:rounded-lg sm:text-sm",
              isLightAuth &&
                id === "twitter" &&
                "h-[52px] rounded-xl border-[#0a0a0a] bg-[#0a0a0a] text-base text-white shadow-[0_14px_30px_rgba(10,10,10,0.2)] hover:border-black hover:bg-black sm:h-12 sm:rounded-lg sm:text-sm"
            )}
            onClick={() => signIn(id, { callbackUrl: "/" })}
          >
            {PROVIDER_LABELS[id]}
          </Button>
        ))}
      </div>
    </div>
  );
}
