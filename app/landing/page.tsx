import Link from "next/link";
import type { Metadata } from "next";
import { Compass, Map, Quote, Sparkles, Zap } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

export const metadata: Metadata = {
  title: "Udala — Meet people with intention",
  description:
    "Udala is the real-time social marketplace where your desires lead the way. Build a Desire Map, see who's available tonight, and unlock creator menus on your terms.",
};

const FEATURES = [
  {
    icon: Map,
    title: "Say exactly what you want",
    description:
      "Build a private Desire Map of your interests — from casual chat to specific kinks — and choose exactly who can see each one. Udala matches you with people already into the same things, so there's no guessing and no awkward reveals.",
  },
  {
    icon: Zap,
    title: "Know who's free, right now",
    description:
      "Flip on a status — available tonight, open to meet, or just here to chat — and see who nearby is live in real time. Plans come together in minutes, not weeks of back-and-forth.",
  },
  {
    icon: Sparkles,
    title: "Unlock creators on your terms",
    description:
      "Subscribe to a creator's menu for exclusive posts, VIP circles, and private-access tiers. Every creator sets their own price and perks, so you choose exactly how close you want to get.",
  },
] as const;

const STEPS = [
  {
    number: "01",
    title: "Build your Desire Map",
    description: "Tell us what you're into, at whatever level of detail you're comfortable with, and set the privacy on each one.",
  },
  {
    number: "02",
    title: "Go available",
    description: "Switch your status on when you're free tonight or open to meeting, and see who's live around you.",
  },
  {
    number: "03",
    title: "Meet, chat, or subscribe",
    description: "Message a match, RSVP to an event, or join a creator's menu — it all happens in one place.",
  },
] as const;

const TESTIMONIALS = [
  {
    quote: "I matched with someone who wanted exactly what I wanted. No guessing games, no wasted messages.",
    name: "Jordan",
    role: "Member since 2025",
  },
  {
    quote: "Available Tonight turned a boring Tuesday into an actual plan in twenty minutes.",
    name: "Alex",
    role: "Member",
  },
  {
    quote: "As a creator, the tier system means I finally get paid for the content I actually want to make.",
    name: "Sam",
    role: "Creator",
  },
] as const;

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neon-pink">{eyebrow}</span>
      <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-4 pb-20 pt-10 text-center sm:pb-28 sm:pt-16">
        <h1 className="font-heading max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Meet people with{" "}
          <span className="bg-brand-gradient bg-clip-text text-transparent">intention</span>.
        </h1>
        <p className="max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
          Udala is the real-time social marketplace where your desires lead the way. Match by what you&apos;re
          actually into, see who&apos;s free tonight, and unlock exclusive content from creators who share your
          interests.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="gap-1.5">
            <Link href="/signup">Get started free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
        <div className="mt-4 h-48 w-48 overflow-hidden rounded-3xl shadow-lift sm:h-56 sm:w-56">
          <BrandLogo className="h-full w-full" priority />
        </div>
      </section>

      {/* Features */}
      <section className="flex flex-col gap-12 px-4 py-16 sm:px-8 sm:py-24">
        <SectionHeading
          eyebrow="Why Udala"
          title="Built around what you actually want"
          description="Three core tools work together so you spend less time guessing and more time connecting."
        />
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient">
                  <Icon className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                </span>
                <h3 className="font-heading text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="flex flex-col gap-12 bg-secondary/30 px-4 py-16 sm:px-8 sm:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="From sign-up to meetup in three steps"
        />
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-6">
              <span className="font-heading text-3xl font-bold text-neon-cyan">{step.number}</span>
              <h3 className="font-heading text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="flex flex-col gap-12 px-4 py-16 sm:px-8 sm:py-24">
        <SectionHeading eyebrow="Real stories" title="People are already finding their people" />
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6"
            >
              <Quote className="h-5 w-5 text-neon-pink" aria-hidden="true" />
              <blockquote className="flex-1 text-sm text-foreground">&ldquo;{testimonial.quote}&rdquo;</blockquote>
              <figcaption className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{testimonial.name}</span> — {testimonial.role}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
        <h2 className="font-heading max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to meet with intention?
        </h2>
        <p className="max-w-md text-muted-foreground">
          Build your Desire Map, see who&apos;s around, and join a community that&apos;s honest about what it wants.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="gap-1.5">
            <Link href="/signup">Get started free</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-1.5">
            <Link href="/discover">
              <Compass className="h-4 w-4" aria-hidden="true" /> Explore first
            </Link>
          </Button>
        </div>
      </section>
      </main>

      <PublicFooter />
    </div>
  );
}
