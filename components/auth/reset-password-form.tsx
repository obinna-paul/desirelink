"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setStatus("submitting");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code, password }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setStatus("idle");
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStatus("success");
    router.push("/login");
  }

  return (
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
          className="h-[52px] rounded-xl border-[#d8c8d2] bg-white text-base text-[#211720] shadow-none focus-visible:ring-[#9b2f66] sm:h-12 sm:rounded-lg sm:text-sm"
        />
      </div>

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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-[#211720]">
          New password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-[52px] rounded-xl border-[#d8c8d2] bg-white text-base text-[#211720] shadow-none focus-visible:ring-[#9b2f66] sm:h-12 sm:rounded-lg sm:text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-[#211720]">
          Confirm new password
        </label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="h-[52px] rounded-xl border-[#d8c8d2] bg-white text-base text-[#211720] shadow-none focus-visible:ring-[#9b2f66] sm:h-12 sm:rounded-lg sm:text-sm"
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
        {status === "submitting" && "Resetting..."}
        {status === "success" && "Done! Redirecting..."}
        {status === "idle" && "Reset password"}
      </Button>
    </form>
  );
}
