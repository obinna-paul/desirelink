"use client";

import { useMemo, useState } from "react";
import { Heart, MessageCircle, Share2 } from "lucide-react";

import { CommentsSheet } from "@/components/posts/comments-sheet";
import { cn } from "@/lib/utils";

export function PostActions({
  postId,
  authorUsername,
  initialCounts,
  initialViewerLiked,
}: {
  postId: string;
  authorUsername: string;
  initialCounts: { reactions: number; comments: number; shares: number };
  initialViewerLiked: boolean;
}) {
  const [liked, setLiked] = useState(initialViewerLiked);
  const [reactionCount, setReactionCount] = useState(initialCounts.reactions);
  const [commentCount, setCommentCount] = useState(initialCounts.comments);
  const [shareCount, setShareCount] = useState(initialCounts.shares);
  const [sheetOpen, setSheetOpen] = useState(false);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/profile/${authorUsername}`;
    return `${window.location.origin}/profile/${authorUsername}?post=${postId}`;
  }, [authorUsername, postId]);

  async function toggleLike() {
    const previousLiked = liked;
    const previousCount = reactionCount;
    setLiked(!liked);
    setReactionCount((count) => count + (liked ? -1 : 1));

    const res = await fetch(`/api/posts/${postId}/reactions`, { method: "POST" });
    if (!res.ok) {
      setLiked(previousLiked);
      setReactionCount(previousCount);
      return;
    }
    const body = await res.json().catch(() => null);
    if (typeof body?.liked === "boolean") setLiked(body.liked);
    if (typeof body?.count === "number") setReactionCount(body.count);
  }

  async function sharePost() {
    const canShare = typeof navigator !== "undefined" && "share" in navigator;
    if (canShare) {
      await navigator.share({ title: "Udala post", url: shareUrl }).catch(() => null);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl).catch(() => null);
    }

    const res = await fetch(`/api/posts/${postId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: canShare ? "web_share" : "copy_link" }),
    });
    const body = await res.json().catch(() => null);
    if (typeof body?.count === "number") setShareCount(body.count);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors",
            liked ? "bg-neon-pink/10 text-neon-pink" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Heart className={cn("h-5 w-5", liked && "fill-current")} aria-hidden="true" />
          {reactionCount}
        </button>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          {commentCount}
        </button>
        <button
          type="button"
          onClick={sharePost}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
          {shareCount}
        </button>
      </div>

      <CommentsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        postId={postId}
        authorUsername={authorUsername}
        onCommentCountChange={setCommentCount}
      />
    </div>
  );
}
