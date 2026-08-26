"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";

import { AccountTypeSelector } from "@/components/account-type-selector";
import { BrandLogo } from "@/components/brand-logo";
import { FormField } from "@/components/auth/form-field";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "access",
    title: "Create your private account",
    description: "Start with secure login details. Your profile setup comes after this.",
  },
  {
    id: "role",
    title: "Choose how you want to enter",
    description: "Udala adapts the first experience around your role.",
  },
  {
    id: "confirm",
    title: "Confirm and continue",
    description: "Next, you will build your Desire Map and privacy settings.",
  },
] as const;

type StepIndex = 0 | 1 | 2;

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(0);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    watch,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { profileType: "EXPLORER" },
  });

  const values = watch();
  const canGoBack = step > 0 && status === "idle";
  const currentStep = STEPS[step];

  const reviewItems = useMemo(
    () => [
      { label: "Name", value: values.name || "Not set" },
      { label: "Email", value: values.email || "Not set" },
      { label: "Role", value: values.profileType?.replace("_", " ") || "Explorer" },
    ],
    [values.email, values.name, values.profileType]
  );

  async function goNext() {
    setServerError(null);

    if (step === 0) {
      const valid = await trigger(["name", "email", "password", "confirmPassword"]);
      if (!valid) return;
    }

    if (step < 2) setStep((step + 1) as StepIndex);
  }

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
    <main className="min-h-screen overflow-hidden bg-[#110d14] px-4 py-5 text-white sm:px-8 sm:py-6">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(248,183,200,0.18),transparent_34%),radial-gradient(circle_at_85%_22%,rgba(116,64,174,0.2),transparent_28%)]"
        aria-hidden="true"
      />
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col">
        <header className="relative z-10 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-3" aria-label="Udala login">
            <span className="flex h-11 w-11 overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/15">
              <BrandLogo className="h-full w-full" priority alt="" />
            </span>
            <span className="font-heading text-xl font-semibold tracking-tight">Udala</span>
          </Link>
          <Link href="/login" className="text-sm font-semibold text-white/62 underline-offset-4 hover:text-white hover:underline">
            Log in
          </Link>
        </header>

        <section className="relative z-10 grid flex-1 items-center gap-6 py-8 sm:gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:py-14">
          <aside className="hidden flex-col gap-8 lg:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f8b7c8]">Join Udala</p>
              <h1 className="mt-4 font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Your account starts private.
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-white/62">
                Create access first. Then we guide you through desires, location privacy, availability, and safety controls.
              </p>
            </div>

            <ol className="flex flex-col gap-3">
              {STEPS.map((item, index) => {
                const isActive = index === step;
                const isDone = index < step;
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex gap-3 rounded-xl border p-4 transition-colors",
                      isActive
                        ? "border-[#f8b7c8]/50 bg-[#f8b7c8]/10"
                        : "border-white/10 bg-white/[0.035]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        isDone || isActive ? "bg-[#f0d5dd] text-[#18131d]" : "bg-white/10 text-white/48"
                      )}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-white/52">{item.description}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f8b7c8]">Join Udala</p>
            <h1 className="mt-3 font-heading text-3xl font-semibold leading-tight tracking-tight">
              Your account starts private.
            </h1>
            <div className="mt-5 flex gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((item, index) => (
                <span
                  key={item.id}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    index <= step ? "bg-[#f0d5dd]" : "bg-white/12"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.052] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-7">
            <div className="mb-5 sm:mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f8b7c8] sm:text-sm sm:normal-case sm:tracking-normal">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="mt-2 font-heading text-xl font-semibold tracking-tight sm:text-2xl">{currentStep.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/58">{currentStep.description}</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              {step === 0 && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      label="Name"
                      autoComplete="name"
                      registration={register("name")}
                      error={errors.name?.message}
                      variant="auth"
                    />
                    <FormField
                      label="Email"
                      type="email"
                      autoComplete="email"
                      registration={register("email")}
                      error={errors.email?.message}
                      variant="auth"
                    />
                  </div>
                  <FormField
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                    registration={register("password")}
                    error={errors.password?.message}
                    variant="auth"
                  />
                  <FormField
                    label="Confirm password"
                    type="password"
                    autoComplete="new-password"
                    registration={register("confirmPassword")}
                    error={errors.confirmPassword?.message}
                    variant="auth"
                  />
                </>
              )}

              {step === 1 && (
                <Controller
                  control={control}
                  name="profileType"
                  render={({ field }) => (
                    <AccountTypeSelector value={field.value} onChange={field.onChange} variant="auth" />
                  )}
                />
              )}

              {step === 2 && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-white/10 bg-black/18 p-4">
                    {reviewItems.map((item) => (
                      <div
                        key={item.label}
                        className="flex min-h-11 items-center justify-between gap-4 border-b border-white/8 py-2 last:border-0"
                      >
                        <span className="text-sm text-white/48">{item.label}</span>
                        <span className="text-right text-sm font-semibold capitalize text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 rounded-xl border border-[#f8b7c8]/20 bg-[#f8b7c8]/10 p-4 text-sm leading-6 text-white/68">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#f8b7c8]" aria-hidden="true" />
                    <p>
                      After account creation, you will choose what you are looking for, what stays private, and how visible you want to be.
                    </p>
                  </div>
                </div>
              )}

              {serverError && (
                <p role="alert" className="text-sm text-red-300">
                  {serverError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canGoBack}
                  onClick={() => setStep((step - 1) as StepIndex)}
                  className="h-12 rounded-lg border-white/12 bg-transparent text-white hover:border-white/28 hover:bg-white/[0.08]"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
                </Button>

                {step < 2 ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    className="h-12 rounded-lg bg-[#f0d5dd] px-6 text-[#18131d] hover:bg-white"
                  >
                    Continue <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={status !== "idle"}
                    className="h-12 rounded-lg bg-[#f0d5dd] px-6 text-[#18131d] hover:bg-white"
                  >
                    {status === "submitting" && "Creating account..."}
                    {status === "success" && "Success! Logging you in..."}
                    {status === "idle" && "Create account"}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-7">
              <GoogleSignInButton variant="auth" />
            </div>

            <p className="mt-7 text-xs leading-5 text-white/45">
              By continuing, you confirm you are at least 18 years old and agree to Udala&apos;s safety standards.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
