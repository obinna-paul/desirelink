"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { UpdateProfileInput } from "@/lib/validations/profile";
import type { ProviderUpgradeIntent } from "@/components/settings/provider-upgrade-prompt";

const INTENT_COPY: Record<ProviderUpgradeIntent | "default", { title: string; description: string; redirectTo: string }> = {
  default: {
    title: "Switch to a creator account",
    description:
      "This changes what you can create on Udala — premium posts, service listings, or both. You can verify your identity afterward.",
    redirectTo: "/verification",
  },
  "premium-post": {
    title: "Switch before publishing premium posts",
    description: "After switching, you can publish premium content from Create.",
    redirectTo: "/create",
  },
  service: {
    title: "Switch before listing services",
    description: "After switching, you can verify and add your first service listing.",
    redirectTo: "/services/new",
  },
};

export function SwitchToProviderForm({
  currentProfile,
  intent = "default",
}: {
  currentProfile: Omit<UpdateProfileInput, "profileType">;
  intent?: ProviderUpgradeIntent | "default";
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);
  const copy = INTENT_COPY[intent];

  async function handleSwitch() {
    setError(null);
    setStatus("submitting");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...currentProfile, profileType: "CREATOR" }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus("idle");
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push(copy.redirectTo);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6 md:shadow-card">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.title}
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {copy.description}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/verification")} className="h-11">
          Cancel
        </Button>
        <Button type="button" disabled={status === "submitting"} onClick={handleSwitch} className="h-11">
          {status === "submitting" ? "Switching..." : "Switch to Creator"}
        </Button>
      </div>
    </div>
  );
}
