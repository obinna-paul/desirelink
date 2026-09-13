"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { GenderStep } from "@/components/auth/gender-step";

export function GenderPickerForm() {
  const router = useRouter();
  const [gender, setGender] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit() {
    if (!gender) {
      setServerError("Select a gender to continue.");
      return;
    }
    setServerError(null);
    setStatus("submitting");

    const res = await fetch("/api/onboarding/gender", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gender }),
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
      <GenderStep value={gender} onChange={setGender} />
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
