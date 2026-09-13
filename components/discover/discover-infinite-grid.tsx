"use client";

import { useEffect, useRef, useState } from "react";

import { ProfileGrid } from "@/components/home/profile-grid";
import type { ProfileCardData } from "@/lib/home-feed";

/** Discover's endless scroll - the first page comes from the server component as usual;
 * this only takes over for every page after that, fetching from /api/discover as the
 * sentinel at the bottom of the grid comes into view. No page numbers and no "load more"
 * button - profiles keep appending automatically as long as more are available. */
export function DiscoverInfiniteGrid({
  initialProfiles,
  initialHasMore,
  queryString,
  emptyMessage,
}: {
  initialProfiles: ProfileCardData[];
  initialHasMore: boolean;
  /** The current filter query string (no leading "?", no `offset`) - reused as-is for every
   * subsequent page so a fetched page always matches the filters currently on screen. */
  queryString: string;
  emptyMessage: string;
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Filters changed underneath this component (new server-rendered initial page) - reset
  // to it rather than keep appending onto a now-stale accumulated list.
  useEffect(() => {
    setProfiles(initialProfiles);
    setHasMore(initialHasMore);
  }, [initialProfiles, initialHasMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);

        const params = new URLSearchParams(queryString);
        params.set("offset", String(profiles.length));

        fetch(`/api/discover?${params.toString()}`)
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load more"))))
          .then((data: { profiles: ProfileCardData[]; hasMore: boolean }) => {
            setProfiles((current) => [...current, ...data.profiles]);
            setHasMore(data.hasMore);
          })
          .catch(() => setHasMore(false))
          .finally(() => {
            loadingRef.current = false;
            setLoading(false);
          });
      },
      { rootMargin: "600px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, profiles.length, queryString]);

  return (
    <>
      <ProfileGrid profiles={profiles} emptyMessage={emptyMessage} />
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && <span className="text-sm text-muted-foreground">Loading more...</span>}
        </div>
      )}
    </>
  );
}
