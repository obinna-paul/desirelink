"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";

import { AccountTypeSelector } from "@/components/account-type-selector";
import { AuthLogo } from "@/components/auth/auth-logo";
import { FormField } from "@/components/auth/form-field";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
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
    description: "Next, you will land in profile settings with a focused setup checklist.",
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
  const normalizedEmail = values.email?.trim().toLowerCase();
  const selectedRoleLabel =
    ACCOUNT_TYPE_OPTIONS.find((option) => option.value === values.profileType)?.label ?? "Explorer";

  const reviewItems = useMemo(
    () => [
      { label: "Name", value: values.name || "Not set" },
      { label: "Email", value: normalizedEmail || "Not set" },
      { label: "Role", value: selectedRoleLabel },
    ],
    [normalizedEmail, selectedRoleLabel, values.name]
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

    const normalizedData = {
      ...data,
      email: data.email.trim().toLowerCase(),
    };

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedData),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => null);
      setStatus("idle");
      setServerError(responseBody?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStatus("success");

    const result = await signIn("credentials", {
      email: normalizedData.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      router.push("/login");
      return;
    }

    router.push("/profile/edit");
    router.refresh();
  }

  return (
    <main className="min-h-dvh bg-[#f7f1f4] px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1rem)] text-[#1b141b] sm:px-8 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2.25rem)] w-full max-w-5xl flex-col">
        <header className="hidden items-center justify-between lg:flex">
          <AuthLogo compact />
          <Link href="/login" className="text-sm font-semibold text-[#8f285d] underline-offset-4 hover:underline">
            Log in
          </Link>
        </header>

        <div className="lg:hidden">
          <header className="flex justify-center">
            <AuthLogo compact />
          </header>

          <section className="mt-9 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f285d]">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="mx-auto mt-3 max-w-[13ch] font-heading text-[2.25rem] font-semibold leading-[1.04] tracking-tight text-[#171017]">
              {currentStep.title}
            </h1>
            <p className="mx-auto mt-3 max-w-[22rem] text-base leading-7 text-[#6f626b]">{currentStep.description}</p>
            <div className="mx-auto mt-5 flex max-w-48 gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((item, index) => (
                <span
                  key={item.id}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    index <= step ? "bg-[#e91e8f]" : "bg-[#e6d6df]"
                  )}
                />
              ))}
            </div>
          </section>
        </div>

        <section className="grid flex-1 items-start gap-5 py-5 sm:gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:py-14">
          <aside className="hidden flex-col gap-8 lg:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a4962]">Join Udala</p>
              <h1 className="mt-4 max-w-[9ch] font-heading text-5xl font-semibold leading-[1.02] tracking-tight">
                Your account starts private.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-[#675965]">
                Create access first. Then finish profile, verification, visibility, and Desire Map setup from one place.
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
                      "flex gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors",
                      isActive
                        ? "border-[#b893a6]"
                        : "border-[#e2d5dc]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        isDone || isActive ? "bg-[#211720] text-white" : "bg-[#f2e9ee] text-[#8c7a85]"
                      )}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[#211720]">{item.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-[#756771]">{item.description}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a4962]">Join Udala</p>
            <h1 className="mt-3 font-heading text-3xl font-semibold leading-tight tracking-tight text-[#171017]">
              Your account starts private.
            </h1>
            <div className="mt-5 flex gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((item, index) => (
                <span
                  key={item.id}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    index <= step ? "bg-[#211720]" : "bg-[#e1d3dc]"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#ead9e2] bg-white p-5 shadow-[0_18px_55px_rgba(41,22,34,0.08)] sm:p-7 lg:rounded-2xl">
            <div className="mb-5 hidden sm:mb-6 lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f285d] sm:text-sm sm:normal-case sm:tracking-normal">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="mt-2 font-heading text-xl font-semibold tracking-tight text-[#211720] sm:text-2xl">
                {currentStep.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#756771]">{currentStep.description}</p>
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
                      variant="lightAuth"
                    />
                    <FormField
                      label="Email"
                      type="email"
                      autoComplete="email"
                      registration={register("email")}
                      error={errors.email?.message}
                      variant="lightAuth"
                    />
                  </div>
                  <FormField
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                    registration={register("password")}
                    error={errors.password?.message}
                    variant="lightAuth"
                  />
                  <FormField
                    label="Confirm password"
                    type="password"
                    autoComplete="new-password"
                    registration={register("confirmPassword")}
                    error={errors.confirmPassword?.message}
                    variant="lightAuth"
                  />
                </>
              )}

              {step === 1 && (
                <Controller
                  control={control}
                  name="profileType"
                  render={({ field }) => (
                    <AccountTypeSelector value={field.value} onChange={field.onChange} variant="lightAuth" />
                  )}
                />
              )}

              {step === 2 && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-[#e0d2da] bg-[#fbf7f9] p-4">
                    {reviewItems.map((item) => (
                      <div
                        key={item.label}
                        className="flex min-h-11 items-center justify-between gap-4 border-b border-[#e4d7df] py-2 last:border-0"
                      >
                        <span className="text-sm text-[#756771]">{item.label}</span>
                        <span className="text-right text-sm font-semibold capitalize text-[#211720]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 rounded-xl border border-[#e0bfd0] bg-[#fff4f8] p-4 text-sm leading-6 text-[#675965]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8f285d]" aria-hidden="true" />
                    <p>
                      We will take you to profile settings next so you can add a photo, verify your identity, set visibility, and choose your Desire Map when you are ready.
                    </p>
                  </div>
                </div>
              )}

              {serverError && (
                <p role="alert" className="text-sm text-[#b42318]">
                  {serverError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canGoBack}
                  onClick={() => setStep((step - 1) as StepIndex)}
                  className="h-12 w-full rounded-xl border-[#d8c8d2] bg-white text-[#211720] hover:border-[#b893a6] hover:bg-[#fbf6f8] sm:w-auto sm:rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
                </Button>

                {step < 2 ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    className="h-12 w-full rounded-xl bg-[#e91e8f] px-6 text-white shadow-[0_14px_30px_rgba(233,30,143,0.24)] hover:bg-[#c81779] sm:w-auto sm:rounded-lg"
                  >
                    Continue <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={status !== "idle"}
                    className="h-12 w-full rounded-xl bg-[#e91e8f] px-6 text-white shadow-[0_14px_30px_rgba(233,30,143,0.24)] hover:bg-[#c81779] sm:w-auto sm:rounded-lg"
                  >
                    {status === "submitting" && "Creating account..."}
                    {status === "success" && "Success! Logging you in..."}
                    {status === "idle" && "Create account"}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-7">
              <GoogleSignInButton variant="lightAuth" />
            </div>

            <p className="mt-7 text-xs leading-5 text-[#786a73]">
              By continuing, you confirm you are at least 18 years old and agree to Udala&apos;s safety standards.
            </p>
            <p className="mt-5 text-center text-sm leading-6 text-[#6f626b] lg:hidden">
              Already have an account?{" "}
              <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-[#8f285d] underline-offset-4 hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
