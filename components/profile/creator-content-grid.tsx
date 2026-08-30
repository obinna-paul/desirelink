"use client";

import { useState } from "react";

import { EmptyProfileSection } from "@/components/profile/empty-profile-section";
import { PostGridTile, ServiceGridTile } from "@/components/profile/profile-grid-tiles";
import { PostLightbox } from "@/components/profile/post-lightbox";
import { ServiceSummaryModal } from "@/components/profile/service-summary-modal";
import type { PostView } from "@/lib/posts";
import type { ServiceListingView } from "@/lib/service-listings";

export const GRID_CLASSNAME = "grid grid-cols-3 gap-0.5 sm:gap-1 md:grid-cols-4 xl:grid-cols-5";

export function PostGridSection({
  posts,
  emptyTitle,
  emptyDescription,
}: {
  posts: PostView[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [openPost, setOpenPost] = useState<PostView | null>(null);

  if (posts.length === 0) {
    return <EmptyProfileSection title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className={GRID_CLASSNAME}>
        {posts.map((post) => (
          <PostGridTile key={post.id} post={post} onOpen={setOpenPost} />
        ))}
      </div>
      {openPost && <PostLightbox post={openPost} onClose={() => setOpenPost(null)} />}
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
  const [openListing, setOpenListing] = useState<ServiceListingView | null>(null);

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
      <div className={GRID_CLASSNAME}>
        {listings.map((listing) => (
          <ServiceGridTile key={listing.id} listing={listing} onOpen={setOpenListing} />
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
