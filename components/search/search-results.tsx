"use client";

import { useState } from "react";
import Link from "next/link";
import { Hash } from "lucide-react";

import { ProfileGrid } from "@/components/home/profile-grid";
import { PostList } from "@/components/posts/post-list";
import { ServiceListingGrid } from "@/components/home/service-listing-grid";
import type { ProfileCardData } from "@/lib/home-feed";
import type { PostView } from "@/lib/posts";
import type { HomeServiceListingView } from "@/lib/service-listings";
import { cn } from "@/lib/utils";

export type TopResultRow = {
  key: string;
  href: string;
  title: string;
  subtitle: string;
};

const TABS = [
  { key: "top", label: "Top" },
  { key: "people", label: "People" },
  { key: "posts", label: "Posts" },
  { key: "hashtags", label: "Hashtags" },
  { key: "services", label: "Services" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SearchResults({
  query,
  top,
  profiles,
  posts,
  hashtags,
  services,
  viewerProfileId,
}: {
  query: string;
  top: TopResultRow[];
  profiles: ProfileCardData[];
  posts: PostView[];
  hashtags: string[];
  services: HomeServiceListingView[];
  viewerProfileId: string | null;
}) {
  const [tab, setTab] = useState<TabKey>("top");

  if (!query) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground md:rounded-xl md:p-10">
        Search for people, posts, hashtags, and services.
      </div>
    );
  }

  const noResults = top.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "label-caps flex-1 whitespace-nowrap rounded-full px-3 py-2 text-[11px] transition-colors",
              tab === t.key ? "bg-card text-primary shadow-card" : "text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {noResults ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground md:rounded-xl md:p-10">
          No results for &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <>
          {tab === "top" && (
            <div className="flex flex-col gap-1">
              {top.map((row) => (
                <Link
                  key={row.key}
                  href={row.href}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/60"
                >
                  <span className="truncate text-sm font-medium">{row.title}</span>
                  <span className="label-caps shrink-0 text-[10px] text-muted-foreground">{row.subtitle}</span>
                </Link>
              ))}
            </div>
          )}

          {tab === "people" && (
            <ProfileGrid profiles={profiles} emptyMessage="No people match this search." />
          )}

          {tab === "posts" && (
            <PostList posts={posts} emptyMessage="No posts match this search." surface="search" />
          )}

          {tab === "hashtags" &&
            (hashtags.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground md:rounded-xl md:p-10">
                No hashtags match this search.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/hashtag/${tag}`}
                    className="flex items-center gap-1 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-primary/60"
                  >
                    <Hash className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    {tag}
                  </Link>
                ))}
              </div>
            ))}

          {tab === "services" && (
            <ServiceListingGrid
              listings={services}
              emptyMessage="No services match this search."
              viewerProfileId={viewerProfileId}
            />
          )}
        </>
      )}
    </div>
  );
}
