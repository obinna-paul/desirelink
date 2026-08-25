"use client";

import useSWR from "swr";
import { Eye } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PremiumUpsell } from "@/components/premium/premium-upsell";

type ProfileViewer = {
  id: string;
  viewedAt: string;
  viewer: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    city: string;
    country: string;
  };
};

async function fetcher(url: string) {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Couldn't load profile viewers.");
  return body as { viewers: ProfileViewer[] };
}

export function ProfileViewersPanel({ isPremium }: { isPremium: boolean }) {
  const { data, error, isLoading } = useSWR(isPremium ? "/api/profile/viewers" : null, fetcher);

  if (!isPremium) {
    return (
      <PremiumUpsell
        compact
        title="See who viewed you"
        description="Upgrade to udala premium to see recent profile visitors."
      />
    );
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Who viewed you</h2>
          <p className="text-xs text-muted-foreground">Recent non-incognito profile visitors.</p>
        </div>
        <Eye className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading viewers...</p>}
      {error && <p className="mt-4 text-sm text-destructive">{error.message}</p>}
      {data?.viewers.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No profile viewers to show yet.</p>
      )}
      {data && data.viewers.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {data.viewers.slice(0, 8).map((visit) => {
            const location = [visit.viewer.city, visit.viewer.country].filter(Boolean).join(", ");
            return (
              <li
                key={`${visit.viewer.id}-${visit.viewedAt}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/35 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={visit.viewer.avatarUrl} alt={visit.viewer.displayName} />
                    <AvatarFallback className="text-[10px]">
                      {visit.viewer.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{visit.viewer.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{visit.viewer.username}
                      {location ? ` · ${location}` : ""}
                    </p>
                  </div>
                </div>
                <time className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(visit.viewedAt).toLocaleDateString()}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
