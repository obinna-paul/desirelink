"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setServerError(null);
    setStatus("loading");

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setStatus("idle");
      setServerError("Invalid email or password");
      return;
    }

    setStatus("success");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          registration={register("email")}
          error={errors.email?.message}
          variant="auth"
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          registration={register("password")}
          error={errors.password?.message}
          variant="auth"
        />
        <div className="flex justify-end">
          <Link href="/help" className="text-sm font-medium text-[#f8b7c8] underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        {serverError && (
          <p role="alert" className="text-sm text-red-300">
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={status !== "idle"} className="h-12 rounded-lg bg-[#f0d5dd] text-[#18131d] hover:bg-white">
          {status === "loading" && "Logging in..."}
          {status === "success" && "Success! Redirecting..."}
          {status === "idle" && "Log in"}
        </Button>
      </form>

      <GoogleSignInButton variant="auth" />

      <p className="text-center text-sm text-white/58">
        New to Udala?{" "}
        <Link href="/signup" className="font-semibold text-[#f8b7c8] underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
