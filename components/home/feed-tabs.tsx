"use client";

import { useState } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostList } from "@/components/posts/post-list";
import { cn } from "@/lib/utils";
import type { PostView } from "@/lib/posts";
import type { LiveRingEntry } from "@/lib/live-streams";

const TABS = [
  { key: "forYou", label: "For You" },
  { key: "premium", label: "Premium" },
  { key: "live", label: "Live" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function FeedTabs({ posts, liveEntries }: { posts: PostView[]; liveEntries: LiveRingEntry[] }) {
  const [tab, setTab] = useState<TabKey>("forYou");
  const forYou = posts.filter((post) => !post.isSubscriberOnly);
  const premium = posts.filter((post) => post.isSubscriberOnly);
  const live = liveEntries.filter((entry) => entry.isLive);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "label-caps flex-1 rounded-full px-3 py-2 text-[11px] transition-colors",
              tab === t.key ? "bg-card text-primary shadow-card" : "text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "forYou" && (
        <PostList posts={forYou} emptyMessage="No free posts yet. Check back soon." />
      )}

      {tab === "premium" && (
        <PostList
          posts={premium}
          emptyMessage="No premium posts yet. Subscribe to creators to see their exclusive content here."
        />
      )}

      {tab === "live" &&
        (live.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            No one is live right now.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {live.map((entry) => (
              <Link
                key={entry.id}
                href={`/live/${entry.streamId}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage src={entry.avatarUrl} alt="" />
                  <AvatarFallback>{entry.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{entry.displayName}</p>
                  <p className="label-caps text-[10px] text-destructive">Live now</p>
                </div>
                <Radio className="h-4 w-4 text-destructive" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ))}
    </div>
  );
}
