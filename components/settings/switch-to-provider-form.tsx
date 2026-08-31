"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileType } from "@prisma/client";

import { AccountTypeSelector } from "@/components/account-type-selector";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import type { UpdateProfileInput } from "@/lib/validations/profile";
import type { ProviderUpgradeIntent } from "@/components/settings/provider-upgrade-prompt";

const PROVIDER_OPTIONS = ACCOUNT_TYPE_OPTIONS.filter((option) => option.value !== "EXPLORER");

const INTENT_COPY: Record<ProviderUpgradeIntent | "default", { title: string; description: string; redirectTo: string }> = {
  default: {
    title: "Choose a provider type",
    description:
      "This changes what you can create on Udala. You can verify your identity for hosting or paid services afterward.",
    redirectTo: "/settings",
  },
  "premium-post": {
    title: "Switch before publishing premium posts",
    description:
      "Choose the provider path that fits you. After switching, you can publish premium content from Create.",
    redirectTo: "/create",
  },
  event: {
    title: "Switch before hosting events",
    description:
      "Choose the provider path that fits you. After switching, you can request host verification and create events.",
    redirectTo: "/events/new",
  },
  service: {
    title: "Switch before listing services",
    description:
      "Choose the provider path that fits you. After switching, you can verify and add your first service listing.",
    redirectTo: "/profile/edit#services",
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
  const [profileType, setProfileType] = useState<ProfileType>(PROVIDER_OPTIONS[0].value);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);
  const copy = INTENT_COPY[intent];

  async function handleSwitch() {
    setError(null);
    setStatus("submitting");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...currentProfile, profileType }),
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

      <AccountTypeSelector value={profileType} onChange={setProfileType} options={PROVIDER_OPTIONS} />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/settings")} className="h-11">
          Cancel
        </Button>
        <Button type="button" disabled={status === "submitting"} onClick={handleSwitch} className="h-11">
          {status === "submitting" ? "Switching..." : "Switch to Provider"}
        </Button>
      </div>
    </div>
  );
}
