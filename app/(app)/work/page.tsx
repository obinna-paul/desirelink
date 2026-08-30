import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Briefcase, CalendarDays } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";

const OPTIONS = [
  {
    href: "/events",
    label: "Events",
    description: "Discover and RSVP to things happening near you.",
    icon: CalendarDays,
  },
  {
    href: "/discover?section=services",
    label: "Services",
    description: "Book a paid service from a provider.",
    icon: Briefcase,
  },
] as const;

export default async function WorkHubPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Events & Services" description="Find things happening near you, or book a paid service." />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Events & Services</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Link
              key={option.href}
              href={option.href}
              className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:shadow-card md:rounded-xl"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-heading text-lg font-semibold">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.description}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
