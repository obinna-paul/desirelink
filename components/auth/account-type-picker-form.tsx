"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { AccountTypeStep } from "@/components/auth/account-type-step";

export function AccountTypePickerForm() {
  const router = useRouter();
  const [profileType, setProfileType] = useState<ProfileType>("EXPLORER");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit() {
    setServerError(null);
    setStatus("submitting");

    const res = await fetch("/api/onboarding/account-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileType }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus("idle");
      setServerError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStatus("success");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <AccountTypeStep value={profileType} onChange={setProfileType} />
      {serverError && (
        <p role="alert" className="text-sm text-[#b42318]">
          {serverError}
        </p>
      )}
      <Button
        type="button"
        disabled={status !== "idle"}
        onClick={onSubmit}
        className="h-[52px] rounded-xl bg-[#050505] text-base text-white shadow-[0_14px_30px_rgba(5,5,5,0.18)] hover:bg-[#1b1b1b] sm:h-12 sm:rounded-lg sm:text-sm"
      >
        {status === "submitting" && "Saving..."}
        {status === "success" && "Success! Redirecting..."}
        {status === "idle" && "Continue"}
      </Button>
    </div>
  );
}
