"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isTurnstileEnabled, TurnstileWidget } from "@/components/auth/turnstile-widget";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter your email address");
      return;
    }
    if (isTurnstileEnabled && !turnstileToken) {
      setError("Please complete the verification challenge");
      return;
    }

    setStatus("submitting");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed, turnstileToken }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus("idle");
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col gap-5 text-center">
        <p className="text-sm leading-6 text-[#6f626b]">
          If an account exists for <strong className="text-[#211720]">{email.trim().toLowerCase()}</strong>, a code is
          on its way.
        </p>
        <Button
          onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`)}
          className="h-[52px] rounded-xl bg-[#050505] text-base text-white shadow-[0_14px_30px_rgba(5,5,5,0.18)] hover:bg-[#1b1b1b] sm:h-12 sm:rounded-lg sm:text-sm"
        >
          I have my code
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-[#211720]">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-[52px] rounded-xl border-[#d8c8d2] bg-white text-base text-[#211720] shadow-none placeholder:text-[#9b8e97] focus-visible:ring-[#9b2f66] sm:h-12 sm:rounded-lg sm:text-sm"
          />
        </div>

        {isTurnstileEnabled && (
          <TurnstileWidget onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
        )}

        {error && (
          <p role="alert" className="text-sm text-[#b42318]">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={status !== "idle" || (isTurnstileEnabled && !turnstileToken)}
          className="h-[52px] rounded-xl bg-[#050505] text-base text-white shadow-[0_14px_30px_rgba(5,5,5,0.18)] hover:bg-[#1b1b1b] sm:h-12 sm:rounded-lg sm:text-sm"
        >
          {status === "submitting" ? "Sending..." : "Send reset code"}
        </Button>
      </form>

      <p className="text-center text-sm leading-6 text-[#6f626b]">
        <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-[#8f285d] underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
