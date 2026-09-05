"use client";

import { useState } from "react";

import { EmptyProfileSection } from "@/components/profile/empty-profile-section";
import {
  PostGridTile,
  ServiceGridTile,
} from "@/components/profile/profile-grid-tiles";
import { PostLightbox } from "@/components/profile/post-lightbox";
import { ServiceSummaryModal } from "@/components/profile/service-summary-modal";
import type { PostView } from "@/lib/posts";
import type { ServiceListingView } from "@/lib/service-listings";

// Two columns (not three) so each tile is noticeably bigger - since tiles are aspect-square
// (see profile-grid-tiles.tsx), fewer columns grows height right along with width.
export const POST_GRID_CLASSNAME =
  "grid grid-cols-2 gap-1 sm:gap-1.5 md:grid-cols-3 xl:grid-cols-4";
export const SERVICE_GRID_CLASSNAME =
  "grid grid-cols-3 gap-0.5 sm:gap-1 md:grid-cols-4 xl:grid-cols-5";

export function PostGridSection({
  posts,
  sectionLabel,
  emptyTitle,
  emptyDescription,
}: {
  posts: PostView[];
  sectionLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  if (posts.length === 0) {
    return (
      <EmptyProfileSection title={emptyTitle} description={emptyDescription} />
    );
  }

  function handleOpen(post: PostView) {
    setOpenPostId(post.id);
    if (!post.locked) {
      fetch(`/api/posts/${post.id}/view`, { method: "POST" }).catch(() => {});
    }
  }

  return (
    <>
      <div className={POST_GRID_CLASSNAME}>
        {posts.map((post) => (
          <PostGridTile key={post.id} post={post} onOpen={handleOpen} />
        ))}
      </div>
      {openPostId && (
        <PostLightbox
          posts={posts}
          initialPostId={openPostId}
          sectionLabel={sectionLabel}
          onClose={() => setOpenPostId(null)}
        />
      )}
    </>
  );
}

export function ServiceGridSection({
  listings,
  providerUsername,
  isOwner,
  emptyTitle,
  emptyDescription,
  emptyActionHref,
  emptyActionLabel,
}: {
  listings: ServiceListingView[];
  providerUsername: string;
  isOwner: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
}) {
  const [openListing, setOpenListing] = useState<ServiceListingView | null>(
    null,
  );

  if (listings.length === 0) {
    return (
      <EmptyProfileSection
        title={emptyTitle}
        description={emptyDescription}
        actionHref={emptyActionHref}
        actionLabel={emptyActionLabel}
      />
    );
  }

  return (
    <>
      <div className={SERVICE_GRID_CLASSNAME}>
        {listings.map((listing) => (
          <ServiceGridTile
            key={listing.id}
            listing={listing}
            onOpen={setOpenListing}
          />
        ))}
      </div>
      {openListing && (
        <ServiceSummaryModal
          listing={openListing}
          providerUsername={providerUsername}
          isOwner={isOwner}
          onClose={() => setOpenListing(null)}
        />
      )}
    </>
  );
}
