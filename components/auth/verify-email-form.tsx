"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VerifyEmailForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setStatus("idle");
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStatus("success");
    router.push("/profile/edit");
    router.refresh();
  }

  async function onResend() {
    setError(null);
    setResendState("sending");
    const res = await fetch("/api/auth/verify-email/resend", { method: "POST" });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setResendState("idle");
      setError(body?.error ?? "Couldn't send a new code. Please try again.");
      return;
    }
    setResendState("sent");
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="otp" className="text-sm font-medium text-[#211720]">
            6-digit code
          </label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="h-[52px] rounded-xl border-[#d8c8d2] bg-white text-center text-lg tracking-[0.4em] text-[#211720] shadow-none placeholder:text-[#c9bcc4] focus-visible:ring-[#9b2f66] sm:h-12 sm:rounded-lg"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-[#b42318]">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={status !== "idle" || code.length !== 6}
          className="h-[52px] rounded-xl bg-[#050505] text-base text-white shadow-[0_14px_30px_rgba(5,5,5,0.18)] hover:bg-[#1b1b1b] sm:h-12 sm:rounded-lg sm:text-sm"
        >
          {status === "submitting" && "Verifying..."}
          {status === "success" && "Verified! Redirecting..."}
          {status === "idle" && "Verify email"}
        </Button>
      </form>

      <div className="text-center text-sm leading-6 text-[#6f626b]">
        {resendState === "sent" ? (
          "New code sent — check your inbox."
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={resendState === "sending"}
            className="inline-flex min-h-11 items-center font-semibold text-[#8f285d] underline-offset-4 hover:underline disabled:opacity-60"
          >
            {resendState === "sending" ? "Sending..." : "Didn't get a code? Resend it"}
          </button>
        )}
      </div>
    </div>
  );
}
