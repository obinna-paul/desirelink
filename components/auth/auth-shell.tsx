"use client";

import Link from "next/link";
import { BadgeCheck, LockKeyhole, ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const TRUST_MARKERS = [
  { icon: BadgeCheck, label: "18+ verified entry" },
  { icon: ShieldCheck, label: "Consent-first spaces" },
  { icon: LockKeyhole, label: "Private by default" },
] as const;

const CHAT_BUBBLES = [
  { text: "Still up?", className: "left-[10%] top-[22%]" },
  { text: "Private invite", className: "right-[12%] top-[34%]" },
  { text: "Matched nearby", className: "left-[14%] bottom-[28%]" },
  { text: "Tonight?", className: "right-[18%] bottom-[18%]" },
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
    <main className="min-h-screen bg-[#110d14] text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(440px,1fr)]">
        <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 lg:block">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/videos/udala-auth-hero.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,13,20,0.26),rgba(17,13,20,0.1)),linear-gradient(0deg,rgba(17,13,20,0.72),rgba(17,13,20,0.04)_48%,rgba(17,13,20,0.44))]" />

          <div className="relative z-10 flex min-h-screen flex-col justify-between p-10">
            <Link href="/landing" className="flex w-fit items-center gap-3" aria-label="Udala home">
              <span className="flex h-12 w-12 overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/15 backdrop-blur">
                <BrandLogo className="h-full w-full" priority alt="" />
              </span>
              <span className="font-heading text-2xl font-semibold tracking-tight">Udala</span>
            </Link>

            <div className="max-w-xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                Premium African social discovery
              </p>
              <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Meet with intention.
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-white/78">
                Private chats, creator circles, events, and real-time availability for adults who know what they want.
              </p>
            </div>

            <div className="hidden flex-wrap gap-2 sm:flex">
              {TRUST_MARKERS.map((marker) => {
                const Icon = marker.icon;
                return (
                  <span
                    key={marker.label}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-black/22 px-3 text-xs font-medium text-white/78 backdrop-blur-md"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#f8b7c8]" aria-hidden="true" />
                    {marker.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
            {CHAT_BUBBLES.map((bubble, index) => (
              <span
                key={bubble.text}
                className={cn(
                  "absolute rounded-2xl border border-white/14 bg-black/24 px-4 py-2 text-sm font-medium text-white/84 shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur-md",
                  "motion-safe:animate-[authFloat_7s_ease-in-out_infinite]",
                  bubble.className
                )}
                style={{ animationDelay: `${index * 650}ms` }}
              >
                {bubble.text}
              </span>
            ))}
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(248,183,200,0.18),transparent_36%),radial-gradient(circle_at_0%_100%,rgba(116,64,174,0.22),transparent_34%)] lg:hidden"
            aria-hidden="true"
          />
          <div className="w-full max-w-[430px]">
            <Link href="/landing" className="mb-8 flex w-fit items-center gap-3 lg:hidden" aria-label="Udala home">
              <span className="flex h-12 w-12 overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/15">
                <BrandLogo className="h-full w-full" priority alt="" />
              </span>
              <span className="font-heading text-2xl font-semibold tracking-tight">Udala</span>
            </Link>
            <div className="mb-8 flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
              <Link
                href="/login"
                className={cn(
                  "flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                  activeMode === "login" ? "bg-white text-[#18131d]" : "text-white/62 hover:text-white"
                )}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  "flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                  activeMode === "signup" ? "bg-white text-[#18131d]" : "text-white/62 hover:text-white"
                )}
              >
                Create account
              </Link>
            </div>

            <div className="mb-7">
              <h2 className="font-heading text-3xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
            </div>

            {children}

            <p className="mt-8 text-xs leading-5 text-white/45">
              By continuing, you confirm you are at least 18 years old and agree to Udala&apos;s{" "}
              <Link href="/help" className="text-[#f8b7c8] underline-offset-4 hover:underline">
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
