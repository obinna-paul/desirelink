import Link from "next/link";
import { CreditCard, ChevronRight, HelpCircle, ShieldCheck, UsersRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";

const SETTINGS_LINKS = [
  {
    href: "/settings/circles",
    label: "Circles",
    description: "Control which members can see private profile fields and desires.",
    icon: UsersRound,
  },
  {
    href: "/settings/billing",
    label: "Billing",
    description: "Payment methods, Premium status, provider subscriptions, and billing history.",
    icon: CreditCard,
  },
  {
    href: "/settings/subscriptions",
    label: "Subscriptions",
    description: "Manage the creators you support and cancel anytime.",
    icon: CreditCard,
  },
  {
    href: "/safety",
    label: "Safety Center",
    description: "Blocked users, report history, and safety tools.",
    icon: ShieldCheck,
  },
  {
    href: "/help",
    label: "Help Center",
    description: "FAQs on your account, payments, events, creator tools, and safety.",
    icon: HelpCircle,
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Settings"
          description="Manage your account, privacy, and safety preferences."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Account, privacy, billing, and safety.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {SETTINGS_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm transition-colors hover:border-neon-pink/60 md:rounded-xl md:p-4 md:shadow-none"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <link.icon className="h-5 w-5 text-neon-pink" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{link.description}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
        More settings coming soon.
      </div>
    </div>
  );
}
