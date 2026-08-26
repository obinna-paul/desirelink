"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, LockKeyhole, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

const TRUST_MARKERS = [
  { icon: BadgeCheck, label: "18+ verified entry" },
  { icon: ShieldCheck, label: "Consent-first spaces" },
  { icon: LockKeyhole, label: "Private by default" },
] as const;

export function AuthShell({
  title,
  description,
  children,
  activeMode,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  activeMode: "login" | "signup";
}) {
  return (
    <main className="min-h-screen bg-[#f7f1f4] text-[#1b141b]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.96fr)_minmax(480px,1.04fr)]">
        <section className="hidden min-h-screen flex-col justify-between overflow-hidden border-r border-[#1e1722] bg-[#07090d] px-10 py-8 text-white lg:flex xl:px-14">
          <div>
            <Link href="/landing" className="flex w-fit items-center gap-3" aria-label="Udala home">
              <Image
                src="/udala-logo.png"
                alt="Udala"
                width={500}
                height={500}
                priority
                className="h-16 w-16 object-contain"
              />
              <span className="font-heading text-2xl font-semibold tracking-tight">Udala</span>
            </Link>
          </div>

          <div className="flex flex-1 flex-col justify-center py-8">
            <div className="mx-auto w-full max-w-[560px]">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#ff4eb3]">
                Premium African social discovery
              </p>
              <h1 className="max-w-[13ch] font-heading text-4xl font-semibold leading-[1.02] tracking-tight xl:text-5xl">
                Create. Earn. Connect.
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-white/68">
                A private, adult-only social experience for creators, providers, pairs, and members across African cities.
              </p>
              <div className="mt-7 flex justify-center">
                <Image
                  src="/images/udala-auth-showcase.png"
                  alt="Udala app preview with an African creator and private social features"
                  width={1122}
                  height={1402}
                  priority
                  className="h-auto max-h-[58vh] w-full max-w-[470px] object-contain"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pb-1">
            {TRUST_MARKERS.map((marker) => {
              const Icon = marker.icon;
              return (
                <span
                  key={marker.label}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 text-xs font-semibold text-white/78"
                >
                  <Icon className="h-3.5 w-3.5 text-[#ff4eb3]" aria-hidden="true" />
                  {marker.label}
                </span>
              );
            })}
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-7 sm:px-8 lg:px-12">
          <div className="w-full max-w-[450px]">
            <Link href="/landing" className="mb-8 flex w-fit items-center lg:hidden" aria-label="Udala home">
              <Image
                src="/udala-logo-light.png"
                alt="Udala"
                width={500}
                height={500}
                priority
                className="h-14 w-14 object-contain"
              />
              <span className="ml-3 font-heading text-2xl font-semibold tracking-tight text-[#211720]">Udala</span>
            </Link>
            <div className="mb-8 flex rounded-xl border border-[#ded0d8] bg-white p-1 shadow-sm">
              <Link
                href="/login"
                className={cn(
                  "flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                  activeMode === "login"
                    ? "bg-[#20161f] text-white"
                    : "text-[#675965] hover:bg-[#f6eef3] hover:text-[#20161f]"
                )}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  "flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                  activeMode === "signup"
                    ? "bg-[#20161f] text-white"
                    : "text-[#675965] hover:bg-[#f6eef3] hover:text-[#20161f]"
                )}
              >
                Create account
              </Link>
            </div>

            <div className="mb-7">
              <h2 className="font-heading text-3xl font-semibold tracking-tight text-[#171017]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6f626b]">{description}</p>
            </div>

            {children}

            <p className="mt-8 text-xs leading-5 text-[#786a73]">
              By continuing, you confirm you are at least 18 years old and agree to Udala&apos;s{" "}
              <Link href="/help" className="font-semibold text-[#8f285d] underline-offset-4 hover:underline">
                safety standards
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
