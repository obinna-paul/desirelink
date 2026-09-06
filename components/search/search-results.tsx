"use client";

import { useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, ChevronRight, Hash, Images, LayoutGrid, UserRound } from "lucide-react";

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
  { key: "top", label: "Top", icon: LayoutGrid },
  { key: "people", label: "People", icon: UserRound },
  { key: "posts", label: "Posts", icon: Images },
  { key: "hashtags", label: "Tags", icon: Hash },
  { key: "services", label: "Services", icon: BriefcaseBusiness },
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
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground md:p-10">
        Search for people, posts, hashtags, and services.
      </div>
    );
  }

  const noResults = top.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
        <div className="flex min-w-max md:grid md:min-w-0 md:grid-cols-5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "relative flex min-h-11 min-w-20 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold transition-colors md:min-w-0 md:text-sm",
              tab === t.key
                ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {t.label}
          </button>
          );
        })}
        </div>
      </div>

      {noResults ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">No results for &ldquo;{query}&rdquo;</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a shorter name, a different spelling, or another hashtag.</p>
        </div>
      ) : (
        <>
          {tab === "top" && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {top.map((row) => (
                <Link
                  key={row.key}
                  href={row.href}
                  className="group flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{row.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{row.subtitle}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
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
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground md:p-10">
                No hashtags match. Try a shorter or broader word.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/hashtag/${encodeURIComponent(tag)}`}
                    className="flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-foreground/30 hover:bg-accent"
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
