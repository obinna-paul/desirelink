"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Copy,
  Eye,
  Lock,
  Pin,
  Play,
} from "lucide-react";

import { formatCents } from "@/lib/creator";
import type { PostView } from "@/lib/posts";
import type { ServiceListingView } from "@/lib/service-listings";

const TILE_SIZES = "(min-width: 1280px) 20vw, (min-width: 768px) 25vw, 33vw";

function TileShell({
  children,
  onClick,
  href,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  ariaLabel: string;
}) {
  const className =
    "group relative aspect-square w-full overflow-hidden bg-muted transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </button>
  );
}

function TileCaption({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/85 px-2 py-1.5 text-left backdrop-blur-sm">
      {children}
    </div>
  );
}

export function PostGridTile({
  post,
  onOpen,
}: {
  post: PostView;
  onOpen: (post: PostView) => void;
}) {
  if (post.locked) {
    const tierLabel = post.requiredTier ? `Subscribe to ${post.requiredTier.name}` : "Subscribe to view";
    return (
      <TileShell
        onClick={() => onOpen(post)}
        ariaLabel={`Locked post. ${tierLabel} to view.`}
      >
        {post.blurredPreview && (
          <Image
            src={post.blurredPreview.url}
            alt=""
            fill
            sizes={TILE_SIZES}
            className={
              post.blurredPreview.cssBlur ? "object-cover blur-xl scale-110" : "object-cover"
            }
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-accent-tint/45 px-3 text-center">
          <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="label-caps text-[10px] text-primary">{tierLabel}</span>
        </div>
      </TileShell>
    );
  }

  const media = post.mediaItems[0];

  return (
    <TileShell
      onClick={() => onOpen(post)}
      ariaLabel={post.content ? `Post: ${post.content.slice(0, 60)}` : "Post"}
    >
      {media ? (
        media.type === "video" ? (
          <video
            src={media.url}
            preload="metadata"
            muted
            playsInline
            className="h-full w-full object-cover"
            aria-hidden="true"
          />
        ) : (
          <Image
            src={media.url}
            alt=""
            fill
            sizes={TILE_SIZES}
            className="object-cover"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-card p-3">
          <p className="line-clamp-5 text-xs leading-5 text-foreground">
            {post.content}
          </p>
        </div>
      )}

      {post.isPinned && (
        <Pin
          className="absolute left-1.5 top-1.5 h-3.5 w-3.5 fill-white text-white drop-shadow"
          aria-hidden="true"
        />
      )}
      {media?.type === "video" && (
        <Play
          className="absolute right-1.5 top-1.5 h-4 w-4 fill-white text-white drop-shadow"
          aria-hidden="true"
        />
      )}
      {post.mediaItems.length > 1 && (
        <Copy
          className="absolute right-1.5 top-1.5 h-4 w-4 -scale-x-100 text-white drop-shadow"
          aria-hidden="true"
        />
      )}
      <div className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-white">
        <Eye className="h-2.5 w-2.5" aria-hidden="true" />
        <span className="text-[10px] font-medium leading-none">
          {post.viewCount.toLocaleString()}
        </span>
      </div>
    </TileShell>
  );
}

export function ServiceGridTile({
  listing,
  onOpen,
}: {
  listing: ServiceListingView;
  onOpen: (listing: ServiceListingView) => void;
}) {
  return (
    <TileShell
      onClick={() => onOpen(listing)}
      ariaLabel={`Service: ${listing.title}, ${formatCents(listing.priceCents)}`}
    >
      {listing.coverImageUrl ? (
        <Image
          src={listing.coverImageUrl}
          alt=""
          fill
          sizes={TILE_SIZES}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <BriefcaseBusiness
            className="h-7 w-7 text-muted-foreground/60"
            aria-hidden="true"
          />
        </div>
      )}
      <TileCaption>
        <p className="truncate text-xs font-semibold text-foreground">
          {listing.title}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {formatCents(listing.priceCents)}
        </p>
      </TileCaption>
    </TileShell>
  );
}
