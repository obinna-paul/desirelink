"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";

import { AccountTypeSelector } from "@/components/account-type-selector";
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
    <main className="min-h-screen bg-[#f7f1f4] px-4 py-5 text-[#1b141b] sm:px-8 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-3" aria-label="Udala login">
            <Image
              src="/udala-logo-light.png"
              alt="Udala"
              width={145}
              height={56}
              priority
              className="h-10 w-auto object-contain"
            />
          </Link>
          <Link href="/login" className="text-sm font-semibold text-[#8f285d] underline-offset-4 hover:underline">
            Log in
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-6 py-8 sm:gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:py-14">
          <aside className="hidden flex-col gap-8 lg:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a4962]">Join Udala</p>
              <h1 className="mt-4 max-w-[9ch] font-heading text-5xl font-semibold leading-[1.02] tracking-tight">
                Your account starts private.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-[#675965]">
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

          <div className="lg:hidden">
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

          <div className="rounded-2xl border border-[#e0d2da] bg-white p-4 shadow-[0_24px_70px_rgba(41,22,34,0.12)] sm:p-7">
            <div className="mb-5 sm:mb-6">
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
                      After account creation, you will choose what you are looking for, what stays private, and how visible you want to be.
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
                  className="h-12 rounded-lg border-[#d8c8d2] bg-white text-[#211720] hover:border-[#b893a6] hover:bg-[#fbf6f8]"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
                </Button>

                {step < 2 ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    className="h-12 rounded-lg bg-[#211720] px-6 text-white hover:bg-[#3a2635]"
                  >
                    Continue <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={status !== "idle"}
                    className="h-12 rounded-lg bg-[#211720] px-6 text-white hover:bg-[#3a2635]"
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
          </div>
        </section>
      </div>
    </main>
  );
}
