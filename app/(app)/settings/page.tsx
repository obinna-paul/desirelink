import Link from "next/link";
import { CreditCard, ChevronRight, ShieldCheck, UsersRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";

const SETTINGS_LINKS = [
  {
    href: "/settings/circles",
    label: "Circles",
    description: "Control which members can see private profile fields and desires.",
    icon: UsersRound,
  },
  {
    href: "/settings/subscriptions",
    label: "Subscriptions",
    description: "Manage the creators you're subscribed to and cancel anytime.",
    icon: CreditCard,
  },
  {
    href: "/safety",
    label: "Safety Center",
    description: "Blocked users, report history, and safety tools.",
    icon: ShieldCheck,
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Manage your account, privacy, and safety preferences."
      />
      <ul className="flex flex-col gap-2">
        {SETTINGS_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-neon-pink/60"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <link.icon className="h-5 w-5 text-neon-pink" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="text-xs text-muted-foreground">{link.description}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        More settings coming soon.
      </div>
    </div>
  );
}
