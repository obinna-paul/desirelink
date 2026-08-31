"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Profile } from "@prisma/client";
import {
  Check,
  Eye,
  FileText,
  Globe2,
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
  const hasVerification = profile.isVerified || profile.isVerifiedCreator || profile.isVerifiedHost;

  const actions = useMemo(
    () => [
      {
        id: "photo",
        title: "Add profile photo",
        description: "Help people recognize you",
        href: "/profile/edit",
        done: Boolean(profile.avatarUrl),
        icon: UserRound,
      },
      {
        id: "bio",
        title: "Write your bio",
        description: "At least 20 characters",
        href: "/profile/edit",
        done: profile.bio.trim().length >= 20,
        icon: FileText,
      },
      {
        id: "city",
        title: "Add your city",
        description: "Power nearby recommendations",
        href: "/profile/edit",
        done: Boolean(profile.city),
        icon: MapPin,
      },
      {
        id: "country",
        title: "Add your country",
        description: "Improve regional discovery",
        href: "/profile/edit",
        done: Boolean(profile.country),
        icon: Globe2,
      },
      {
        id: "desires",
        title: "Set preferences",
        description: "Improve recommendations and match quality",
        href: "/profile/edit/preferences",
        done: profile._count.desires > 0,
        icon: Sparkles,
      },
      {
        id: "availability",
        title: "Set availability",
        description: "Show when you are open to chat or meet",
        href: "/profile/edit",
        done: profile.openToChat || profile.openToMeet,
        icon: Radio,
      },
      {
        id: "verification",
        title: "Verify identity",
        description: "Build trust across messages, events, and circles",
        href: "/profile/edit",
        done: hasVerification,
        icon: ShieldCheck,
      },
      {
        id: "discovery",
        title: "Appear in Discover",
        description: "Let compatible people find you",
        href: "/profile/edit",
        done: profile.showInSearch,
        icon: Eye,
      },
      {
        id: "location-privacy",
        title: "Keep location private",
        description: "Use nearby signals without exact location",
        href: "/profile/edit",
        done: !profile.showExactLocation,
        icon: ShieldCheck,
      },
      {
        id: "visibility",
        title: "Review visibility",
        description: "Confirm search and privacy settings",
        href: "/profile/edit",
        done: profile.showInSearch && !profile.showExactLocation,
        icon: Eye,
      },
    ],
    [hasVerification, profile]
  );

  const completed = actions.filter((action) => action.done).length;
  const progress = Math.round((completed / actions.length) * 100);
  const actionStateSignature = actions.map((action) => `${action.id}:${action.done}`).join("|");
  const pendingIds = useMemo(() => actions.filter((action) => !action.done).slice(0, 3).map((action) => action.id), [actions]);
  const previousDoneRef = useRef<Map<string, boolean> | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>(() => pendingIds);
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const previousDone = previousDoneRef.current;
    const currentDone = new Map(actions.map((action) => [action.id, action.done]));

    if (previousDone) {
      const newlyCompleted = actions
        .filter((action) => action.done && previousDone.get(action.id) === false)
        .map((action) => action.id);
      const visibleNewlyCompleted = newlyCompleted.filter((id) => visibleIds.includes(id));

      if (visibleNewlyCompleted.length > 0) {
        setExitingIds((current) => new Set(Array.from(current).concat(visibleNewlyCompleted)));
        const timeout = window.setTimeout(() => {
          setExitingIds((current) => {
            const next = new Set(current);
            visibleNewlyCompleted.forEach((id) => next.delete(id));
            return next;
          });
          setVisibleIds(pendingIds);
        }, 360);

        previousDoneRef.current = currentDone;
        return () => window.clearTimeout(timeout);
      }
    }

    if (exitingIds.size === 0) {
      setVisibleIds((current) => {
        const currentSignature = current.join("|");
        const nextSignature = pendingIds.join("|");
        return currentSignature === nextSignature ? current : pendingIds;
      });
    }

    previousDoneRef.current = currentDone;
  }, [actions, actionStateSignature, exitingIds.size, pendingIds, visibleIds]);

  const actionById = new Map(actions.map((action) => [action.id, action]));
  const visibleActions = visibleIds
    .map((id) => actionById.get(id))
    .filter((action): action is (typeof actions)[number] => Boolean(action));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Quick actions</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Finish the setup items that affect trust, matching, and profile completeness.
          </p>
        </div>
        <span className="label-caps rounded-full border border-accent-tint-border bg-accent-tint px-2.5 py-1 text-primary">
          {completed}/{actions.length}
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {visibleActions.length > 0 ? visibleActions.map((action) => {
          const Icon = action.icon;
          const isExiting = exitingIds.has(action.id);
          return (
            <Link
              key={action.id}
              href={action.href}
              aria-hidden={isExiting}
              tabIndex={isExiting ? -1 : undefined}
              className={cn(
                "group flex max-h-24 min-h-[58px] items-center gap-3 overflow-hidden rounded-xl border border-border bg-muted/60 px-3 py-2.5 transition-[max-height,min-height,opacity,transform,margin,padding,border-color,background-color] duration-300 ease-out hover:border-primary/40 hover:bg-accent-tint/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none",
                isExiting && "pointer-events-none max-h-0 -translate-x-8 border-transparent py-0 opacity-0"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                  action.done
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-accent-tint-border bg-accent-tint text-primary"
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
        }) : (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Your setup is complete.
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <p>Location can stay approximate. Exact location remains off unless you enable it.</p>
      </div>
    </section>
  );
}
