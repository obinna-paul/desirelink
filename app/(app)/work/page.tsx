import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Briefcase, CalendarDays } from "lucide-react";

import { authOptions } from "@/lib/auth";

const OPTIONS = [
  {
    href: "/events",
    label: "Events",
    description: "Discover and RSVP to things happening near you.",
    icon: CalendarDays,
  },
  {
    href: "/services",
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
