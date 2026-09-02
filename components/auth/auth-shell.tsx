"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, LockKeyhole, ShieldCheck } from "lucide-react";

import { AuthLogo } from "@/components/auth/auth-logo";
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
  hideLogoIcon = false,
  hideFooter = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  hideLogoIcon?: boolean;
  /** Suppresses the default "18+ / safety standards" footer paragraph - use when the page's
   * own content (e.g. LoginForm's consent checkbox) already covers that agreement. */
  hideFooter?: boolean;
}) {
  return (
    <main className="min-h-dvh bg-[#f7f1f4] text-[#1b141b] lg:h-dvh lg:overflow-hidden">
      <div className="flex min-h-dvh flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] lg:hidden">
        <header className="flex justify-center">
          <AuthLogo compact hideIcon={hideLogoIcon} />
        </header>

        <section className="mt-10 text-center">
          <h1 className="font-heading text-[2.35rem] font-semibold leading-[1.02] tracking-tight text-[#171017]">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-[22rem] text-base leading-7 text-[#6f626b]">{description}</p>
        </section>

        <section className="mt-9 flex-1">
          {children}

          {!hideFooter && (
            <p className="mt-6 text-center text-xs leading-5 text-[#786a73]">
              By continuing, you confirm you are at least 18 years old and agree to udala&apos;s{" "}
              <Link href="/help" className="font-semibold text-[#8f285d] underline-offset-4 hover:underline">
                safety standards
              </Link>
              .
            </p>
          )}
        </section>
      </div>

      <div className="hidden min-h-dvh lg:grid lg:h-dvh lg:grid-cols-[minmax(0,0.96fr)_minmax(480px,1.04fr)]">
        <section className="hidden h-dvh flex-col justify-between overflow-hidden border-r border-[#1e1722] bg-[#07090d] px-9 py-5 text-white lg:flex xl:px-12">
          <div>
            <AuthLogo variant="dark" hideIcon={hideLogoIcon} />
          </div>

          <div className="flex flex-1 flex-col justify-center py-2">
            <div className="mx-auto w-full max-w-[520px]">
              <h1 className="max-w-[13ch] bg-[linear-gradient(115deg,#ff4eb3_0%,#ff7a4f_34%,#f7d154_52%,#b85cff_76%,#45d4ff_100%)] bg-clip-text font-heading text-4xl font-semibold leading-[1.02] tracking-tight text-transparent xl:text-[3rem]">
                Create. Earn. Connect
              </h1>
              <p className="mt-3 max-w-md text-base leading-7 text-white/72">
                A private, adult-only social experience for creators, providers, pairs, and members across African cities.
              </p>
              <div className="mt-3 flex justify-center">
                <Image
                  src={authShowcase}
                  alt="Udala app preview with an African creator and private social features"
                  priority
                  unoptimized
                  sizes="(min-width: 1024px) 38vw, 0px"
                  className="h-auto max-h-[32vh] w-full max-w-[300px] object-contain xl:max-h-[34vh] xl:max-w-[330px]"
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
            <div className="mb-5">
              <h2 className="font-heading text-3xl font-semibold tracking-tight text-[#171017]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6f626b]">{description}</p>
            </div>

            {children}

            {!hideFooter && (
              <p className="mt-5 text-xs leading-5 text-[#786a73]">
                By continuing, you confirm you are at least 18 years old and agree to udala&apos;s{" "}
                <Link href="/help" className="font-semibold text-[#8f285d] underline-offset-4 hover:underline">
                  safety standards
                </Link>
                .
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
