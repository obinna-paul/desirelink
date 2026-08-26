import Link from "next/link";
import type { Profile } from "@prisma/client";
import {
  Check,
  Eye,
  MapPin,
  Radio,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SetupProfile = Pick<
  Profile,
  | "avatarUrl"
  | "bio"
  | "city"
  | "country"
  | "openToChat"
  | "openToMeet"
  | "showInSearch"
  | "showExactLocation"
  | "isVerified"
  | "isVerifiedCreator"
  | "isVerifiedHost"
> & {
  _count: { desires: number };
};

export function ProfileSetupActions({ profile }: { profile: SetupProfile }) {
  const hasBasics =
    Boolean(profile.avatarUrl) &&
    profile.bio.trim().length >= 20 &&
    Boolean(profile.city) &&
    Boolean(profile.country);
  const hasVerification = profile.isVerified || profile.isVerifiedCreator || profile.isVerifiedHost;

  const actions = [
    {
      title: "Complete profile",
      description: "Photo, bio, city, and basics",
      href: "/profile/edit",
      done: hasBasics,
      icon: UserRound,
    },
    {
      title: "Set Desire Map",
      description: "Improve recommendations and match quality",
      href: "/profile/edit#desire-map",
      done: profile._count.desires > 0,
      icon: Sparkles,
    },
    {
      title: "Set availability",
      description: "Show when you are open to chat or meet",
      href: "/profile/edit",
      done: profile.openToChat || profile.openToMeet,
      icon: Radio,
    },
    {
      title: "Verify identity",
      description: "Build trust across messages, events, and circles",
      href: "/profile/edit",
      done: hasVerification,
      icon: ShieldCheck,
    },
    {
      title: "Review visibility",
      description: "Control search and location privacy",
      href: "/profile/edit",
      done: profile.showInSearch && !profile.showExactLocation,
      icon: Eye,
    },
  ];

  const completed = actions.filter((action) => action.done).length;
  const progress = Math.round((completed / actions.length) * 100);

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Quick actions</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Finish the setup items that affect trust, matching, and profile completeness.
          </p>
        </div>
        <span className="rounded-full border border-neon-pink/30 bg-neon-pink/10 px-2.5 py-1 text-xs font-semibold text-neon-pink">
          {progress}%
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-neon-pink transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className="group flex min-h-[58px] items-center gap-3 rounded-xl border border-border/60 bg-background/45 px-3 py-2.5 transition-colors hover:border-neon-pink/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                  action.done
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-neon-pink/25 bg-neon-pink/10 text-neon-pink"
                )}
              >
                {action.done ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{action.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{action.description}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/60 bg-background/45 p-3 text-xs leading-5 text-muted-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-pink" aria-hidden="true" />
        <p>Location can stay approximate. Exact location remains off unless you enable it.</p>
      </div>
    </section>
  );
}
