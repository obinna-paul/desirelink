import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarDays,
  CreditCard,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { FaqItem } from "@/components/help/faq-item";

export const metadata: Metadata = {
  title: "Help Center — udala",
  description: "Answers to common questions about your account, payments, events, creator tools, and safety on udala.",
};

const CATEGORIES = [
  { id: "account-privacy", title: "Account & Privacy", icon: UserCog },
  { id: "payments-subscriptions", title: "Payments & Subscriptions", icon: CreditCard },
  { id: "events-meetups", title: "Events & Meetups", icon: CalendarDays },
  { id: "creators", title: "Creators", icon: Sparkles },
  { id: "safety-reporting", title: "Safety & Reporting", icon: ShieldCheck },
] as const;

function CategorySection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: (typeof CATEGORIES)[number]["icon"];
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Icon className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
        </span>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export default function HelpCenterPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Help Center</h1>
          <p className="text-muted-foreground">
            Answers to the questions we hear most, grouped by topic. Can&apos;t find what you need?
            Reach out from the <Link href="/safety" className="text-neon-pink underline underline-offset-2">Safety Center</Link>.
          </p>
        </div>

        <nav aria-label="Help topics" className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <a
              key={category.id}
              href={`#${category.id}`}
              className="inline-flex min-h-11 items-center rounded-full border border-border/60 bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-neon-pink/60 hover:text-foreground"
            >
              {category.title}
            </a>
          ))}
        </nav>

        <CategorySection id="account-privacy" title="Account & Privacy" icon={UserCog}>
          <FaqItem question="How do I control who sees my Preferences?">
            <p>
              Preferences are private by default and still improve recommendations. In Profile settings,
              you can choose whether selected preferences appear on your profile. Manage this from{" "}
              <Link href="/profile/edit">Profile → Edit</Link>.
            </p>
          </FaqItem>
          <FaqItem question="What does Incognito mode actually hide?">
            <p>
              Turning on Incognito removes you from Discover, search, and every Home feed tab for
              other members. You can still browse normally yourself, and toggling it off restores your
              visibility immediately. Find it under{" "}
              <Link href="/profile/edit">Profile → Edit → Privacy &amp; visibility</Link>.
            </p>
          </FaqItem>
          <FaqItem question="What's the difference between Verified, Verified Creator, and Verified Host?">
            <p>
              <strong>Verified</strong> is a self-service attestation you toggle yourself from{" "}
              <Link href="/profile/edit">Profile → Edit</Link>. <strong>Verified Creator</strong> and{" "}
              <strong>Verified Host</strong> badges are different — they require submitting a
              government ID and a selfie for manual review, from{" "}
              <Link href="/creator-dashboard?tab=verification">Creator Studio → Verification</Link> or{" "}
              <Link href="/events/manage">Manage Events</Link>.
            </p>
          </FaqItem>
          <FaqItem question="What are Circles, and how do I manage who's in them?">
            <p>
              Circles are groups you create to control who sees your Followers-level content. You add
              and remove members from{" "}
              <Link href="/settings/circles">Settings → Circles</Link>.
            </p>
          </FaqItem>
        </CategorySection>

        <CategorySection id="payments-subscriptions" title="Payments & Subscriptions" icon={CreditCard}>
          <FaqItem question="Is checkout on udala a real charge?">
            <p>
              In this build, checkout is simulated end to end — you&apos;ll see &ldquo;Mock payment, no
              real charge is made&rdquo; on the checkout screen itself, with buttons to simulate success
              or failure so you can test the full flow safely.
            </p>
          </FaqItem>
          <FaqItem question="How do I cancel a creator subscription?">
            <p>
              Go to{" "}
              <Link href="/settings/subscriptions">Settings → Subscriptions</Link>, find the
              subscription, and cancel it. You keep access until the current billing period ends.
            </p>
          </FaqItem>
          <FaqItem question={'What happens if I RSVP "Going" to a priced event?'}>
            <p>
              You&apos;ll be walked through checkout before your spot is confirmed — RSVPing alone
              doesn&apos;t reserve a paid spot until payment completes.
            </p>
          </FaqItem>
        </CategorySection>

        <CategorySection id="events-meetups" title="Events & Meetups" icon={CalendarDays}>
          <FaqItem question="What do Going, Interested, and Can't Go actually do?">
            <p>
              &ldquo;Going&rdquo; confirms your attendance (and completes payment first, if the event is
              priced). &ldquo;Interested&rdquo; signals you might attend without committing, and shows up
              in the host&apos;s RSVP breakdown. &ldquo;Can&apos;t Go&rdquo; simply removes any prior RSVP.
            </p>
          </FaqItem>
          <FaqItem question="What's the difference between a public and private event?">
            <p>
              Public events appear in <Link href="/events">Events</Link> browsing for everyone. Private
              events still accept RSVPs the same way, but only show up if someone already has the direct
              link.
            </p>
          </FaqItem>
          <FaqItem question="Can I chat with other attendees before the event?">
            <p>
              Yes — every event has its own group chat, open to the host and anyone RSVP&apos;d
              &ldquo;Going,&rdquo; right on the event page&apos;s Chat tab.
            </p>
          </FaqItem>
          <FaqItem question="How do I host my own event?">
            <p>
              Create one from <Link href="/events/new">Host a new event</Link>, then manage RSVPs,
              edit details, and moderate the event chat from{" "}
              <Link href="/events/manage">Manage Events</Link>.
            </p>
          </FaqItem>
        </CategorySection>

        <CategorySection id="creators" title="Creators" icon={Sparkles}>
          <FaqItem question="How do Creator Tiers work?">
            <p>
              Turn on Creator mode from <Link href="/profile/edit">Profile → Edit</Link>, then build
              tiers with your own pricing and perks from{" "}
              <Link href="/creator-dashboard?tab=tiers">Creator Studio → Tiers</Link>.
            </p>
          </FaqItem>
          <FaqItem question="What are the Limited and Requires approval tier settings for?">
            <p>
              A <strong>Limited</strong> tier caps the number of Fans — useful for VIP circles or
              private-access tiers. <strong>Requires approval</strong> means new Fans show up
              under{" "}
              <Link href="/creator-dashboard?tab=audience">Creator Studio → Audience</Link>{" "}
              for you to accept or deny before they get access.
            </p>
          </FaqItem>
          <FaqItem question="How do I apply for Verified Creator status?">
            <p>
              From <Link href="/creator-dashboard?tab=verification">Creator Studio → Verification</Link>,
              upload a government ID and a selfie. Our team reviews it manually and approves or denies
              the request.
            </p>
          </FaqItem>
          <FaqItem question="Where can I see my Fan growth and earnings?">
            <p>
              The <Link href="/creator-dashboard?tab=audience">Audience tab</Link> on your dashboard
              charts both over time, and the{" "}
              <Link href="/creator-dashboard?tab=assistant">Assistant tab</Link> surfaces your top fans,
              Fans who&apos;ve gone quiet, and suggested posting times.
            </p>
          </FaqItem>
        </CategorySection>

        <CategorySection id="safety-reporting" title="Safety & Reporting" icon={ShieldCheck}>
          <FaqItem question="How do I block someone?">
            <p>
              Use the Block button on their profile page. They&apos;ll no longer be able to view your
              profile or message you, and any existing conversation stays visible for your records but
              can&apos;t be added to. Manage blocks from{" "}
              <Link href="/safety/blocked">Safety Center → Blocked</Link>.
            </p>
          </FaqItem>
          <FaqItem question="How do I report a profile, message, post, or event?">
            <p>
              Look for the report flag icon on the profile, message, post, or event in question, choose
              a reason, and add optional details. Track your submissions from{" "}
              <Link href="/safety/reports">Safety Center → My Reports</Link>.
            </p>
          </FaqItem>
          <FaqItem question="What is community standing, and how do I get a Trusted badge?">
            <p>
              Community standing is a score built from account age, verification, positive reviews, and
              any reports against you. Crossing a trust threshold with no unresolved serious reports
              earns the Trusted badge automatically — it isn&apos;t something you can turn on yourself.
            </p>
          </FaqItem>
          <FaqItem question="What happens after I submit a report?">
            <p>
              Our team reviews it, and repeated or serious reports affect the reported member&apos;s
              community standing. You can follow the status of anything you&apos;ve reported from{" "}
              <Link href="/safety/reports">Safety Center → My Reports</Link>.
            </p>
          </FaqItem>
        </CategorySection>
      </main>

      <PublicFooter />
    </div>
  );
}
