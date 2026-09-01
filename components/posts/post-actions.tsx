"use client";

import { Heart, MessageCircle, Share2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function PostActions({
  liked,
  reactionCount,
  commentCount,
  shareCount,
  onToggleLike,
  onOpenComments,
  onShare,
  likeDisabled = false,
}: {
  liked: boolean;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  onToggleLike: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  likeDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleLike}
          aria-pressed={liked}
          disabled={likeDisabled}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors disabled:opacity-60",
            liked ? "text-neon-pink" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Heart className={cn("h-5 w-5", liked && "fill-current")} aria-hidden="true" />
          {reactionCount}
        </button>
        <button
          type="button"
          onClick={onOpenComments}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          {commentCount}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
          {shareCount}
        </button>
      </div>
    </div>
  );
}
