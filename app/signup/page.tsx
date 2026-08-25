"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";

export default function SignupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(data: SignupInput) {
    setServerError(null);
    setStatus("submitting");

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => null);
      setStatus("idle");
      setServerError(responseBody?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStatus("success");

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      router.push("/login");
      return;
    }

    router.push("/onboarding/desires");
    router.refresh();
  }

  return (
    <AuthCard title="Create your account" description="Join udala in seconds.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          label="Name"
          autoComplete="name"
          registration={register("name")}
          error={errors.name?.message}
        />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          registration={register("email")}
          error={errors.email?.message}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          registration={register("password")}
          error={errors.password?.message}
        />
        <FormField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          registration={register("confirmPassword")}
          error={errors.confirmPassword?.message}
        />
        {serverError && (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={status !== "idle"}>
          {status === "submitting" && "Creating account..."}
          {status === "success" && "Success! Logging you in..."}
          {status === "idle" && "Sign up"}
        </Button>
      </form>

      <GoogleSignInButton />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-neon-pink underline underline-offset-2">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
