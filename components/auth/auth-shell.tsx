"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, LockKeyhole, ShieldCheck } from "lucide-react";

import authShowcase from "@/public/images/udala-auth-showcase.png";

const TRUST_MARKERS = [
  { icon: BadgeCheck, label: "18+ verified entry" },
  { icon: ShieldCheck, label: "Consent-first spaces" },
  { icon: LockKeyhole, label: "Private by default" },
] as const;

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[#f7f1f4] text-[#1b141b] lg:h-dvh lg:overflow-hidden">
      <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[minmax(0,0.96fr)_minmax(480px,1.04fr)]">
        <section className="hidden h-dvh flex-col justify-between overflow-hidden border-r border-[#1e1722] bg-[#07090d] px-9 py-5 text-white lg:flex xl:px-12">
          <div>
            <Link href="/landing" className="flex w-fit items-center gap-3" aria-label="Udala home">
              <Image
                src="/udala-logo.png"
                alt="Udala"
                width={500}
                height={500}
                priority
                className="h-14 w-14 object-contain"
              />
              <span className="font-heading text-2xl font-semibold tracking-tight">Udala</span>
            </Link>
          </div>

          <div className="flex flex-1 flex-col justify-center py-4">
            <div className="mx-auto w-full max-w-[520px]">
              <h1 className="max-w-[13ch] font-heading text-4xl font-semibold leading-[1.02] tracking-tight xl:text-[3.35rem]">
                Create. Earn. Connect.
              </h1>
              <p className="mt-3 max-w-md text-base leading-7 text-white/68">
                A private, adult-only social experience for creators, providers, pairs, and members across African cities.
              </p>
              <div className="mt-4 flex justify-center">
                <Image
                  src={authShowcase}
                  alt="Udala app preview with an African creator and private social features"
                  priority
                  unoptimized
                  sizes="(min-width: 1024px) 38vw, 0px"
                  className="h-auto max-h-[48vh] w-full max-w-[400px] object-contain xl:max-h-[50vh] xl:max-w-[430px]"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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

        <section className="flex min-h-dvh items-center justify-center px-5 py-6 sm:px-8 lg:h-dvh lg:min-h-0 lg:overflow-hidden lg:px-12 lg:py-5">
          <div className="w-full max-w-[450px]">
            <Link href="/landing" className="mb-6 flex w-fit items-center lg:hidden" aria-label="Udala home">
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

            <div className="mb-5">
              <h2 className="font-heading text-3xl font-semibold tracking-tight text-[#171017]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6f626b]">{description}</p>
            </div>

            {children}

            <p className="mt-5 text-xs leading-5 text-[#786a73]">
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
