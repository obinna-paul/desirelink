"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LoginConsent } from "@/components/auth/login-consent";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(() =>
    getAuthErrorMessage(searchParams.get("error"))
  );
  const [agreed, setAgreed] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setServerError(null);
    setStatus("loading");

    const result = await signIn("credentials", {
      identifier: data.identifier,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setStatus("idle");
      setServerError("Invalid email/username or password");
      return;
    }

    setStatus("success");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-5">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 sm:gap-4">
        <FormField
          label="Email or username"
          autoComplete="username"
          registration={register("identifier")}
          error={errors.identifier?.message}
          variant="lightAuth"
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          registration={register("password")}
          error={errors.password?.message}
          variant="lightAuth"
        />
        <div className="flex justify-end">
          <Link
            href="/help"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[#8f285d] underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        {serverError && (
          <p role="alert" className="text-sm text-[#b42318]">
            {serverError}
          </p>
        )}
        <LoginConsent agreed={agreed} onAgreedChange={setAgreed} />
        <Button
          type="submit"
          disabled={status !== "idle" || !agreed}
          className="h-[52px] rounded-xl bg-[#050505] text-base text-white shadow-[0_14px_30px_rgba(5,5,5,0.18)] hover:bg-[#1b1b1b] sm:h-12 sm:rounded-lg sm:text-sm"
        >
          {status === "loading" && "Logging in..."}
          {status === "success" && "Success! Redirecting..."}
          {status === "idle" && "Log in"}
        </Button>
      </form>

      <GoogleSignInButton variant="lightAuth" />

      <p className="text-center text-sm leading-6 text-[#6f626b]">
        New to udala?{" "}
        <Link href="/signup" className="inline-flex min-h-11 items-center font-semibold text-[#8f285d] underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
