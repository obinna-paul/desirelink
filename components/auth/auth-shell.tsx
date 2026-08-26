"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CalendarDays, LockKeyhole, MapPin, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const TRUST_MARKERS = [
  { icon: BadgeCheck, label: "18+ verified entry" },
  { icon: ShieldCheck, label: "Consent-first spaces" },
  { icon: LockKeyhole, label: "Private by default" },
] as const;

const EXPERIENCE_POINTS = [
  { icon: MapPin, label: "Nearby", value: "Location-aware matches" },
  { icon: Sparkles, label: "Creator access", value: "Circles, posts, and private plans" },
  { icon: CalendarDays, label: "Events", value: "Recommended nights and rooms" },
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
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.92fr)_minmax(480px,1.08fr)]">
        <section className="hidden min-h-screen flex-col justify-between border-r border-[#e5d8df] bg-[#fbf8f9] px-10 py-9 lg:flex xl:px-14">
          <div>
            <Link href="/landing" className="flex w-fit items-center gap-3" aria-label="Udala home">
              <Image
                src="/udala-logo-light.png"
                alt="Udala"
                width={164}
                height={64}
                priority
                className="h-12 w-auto object-contain"
              />
            </Link>
          </div>

          <div className="max-w-xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#8a4962]">
                Premium African social discovery
            </p>
            <h1 className="max-w-[11ch] font-heading text-5xl font-semibold leading-[0.98] tracking-tight text-[#171017] xl:text-6xl">
              Meet with intention.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#61535d]">
              Private chats, creator circles, events, and availability tools for verified adults who want a more deliberate social app.
            </p>

            <div className="mt-9 grid max-w-lg gap-3">
              {EXPERIENCE_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <div key={point.label} className="grid grid-cols-[2.75rem_1fr] items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#211720] text-[#f4d1da]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[#211720]">{point.label}</span>
                      <span className="block text-sm text-[#786a73]">{point.value}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {TRUST_MARKERS.map((marker) => {
              const Icon = marker.icon;
              return (
              <span
                  key={marker.label}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#e0c9d4] bg-white px-3 text-xs font-semibold text-[#51454e] shadow-sm"
              >
                  <Icon className="h-3.5 w-3.5 text-[#a32f68]" aria-hidden="true" />
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
                width={150}
                height={58}
                priority
                className="h-11 w-auto object-contain"
              />
            </Link>
            <div className="mb-8 flex rounded-xl border border-[#ded0d8] bg-white p-1 shadow-sm">
              <Link
                href="/login"
                className={cn(
                  "flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                  activeMode === "login" ? "bg-[#20161f] text-white" : "text-[#675965] hover:bg-[#f6eef3] hover:text-[#20161f]"
                )}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  "flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                  activeMode === "signup" ? "bg-[#20161f] text-white" : "text-[#675965] hover:bg-[#f6eef3] hover:text-[#20161f]"
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
