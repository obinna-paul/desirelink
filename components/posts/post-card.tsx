"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Lock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PostActions } from "@/components/posts/post-actions";
import { PostCaption } from "@/components/posts/post-caption";
import { PostEventAttachment } from "@/components/posts/post-event-attachment";
import { PostMediaCarousel } from "@/components/posts/post-media-carousel";
import { PostOwnerControls } from "@/components/posts/post-owner-controls";
import { ReportDialog } from "@/components/safety/report-dialog";
import type { PostView } from "@/lib/posts";

function LockedPostBody({
  reason,
  authorUsername,
}: {
  reason: PostView["lockReason"];
  authorUsername: string;
}) {
  const isPremiumLimit = reason === "premium_provider_limit";

  return (
    <div className="relative flex aspect-[4/5] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-foreground px-6 text-center text-background md:rounded-lg">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background/10">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="font-heading text-lg italic font-medium">
        {isPremiumLimit ? "Premium access" : "Subscriber exclusive"}
      </p>
      <p className="max-w-xs text-sm text-background/70">
        {isPremiumLimit
          ? "Free accounts can view 5 free provider posts per day. Upgrade for unlimited provider content."
          : "Subscribe to this creator to see this post."}
      </p>
      <Button asChild size="sm" className="mt-1">
        <Link href={isPremiumLimit ? "/settings/billing" : `/profile/${authorUsername}`}>
          {isPremiumLimit ? "Upgrade to Premium" : "Subscribe to Unlock"}
        </Link>
      </Button>
    </div>
  );
}

export function PostCard({ post, showAuthor = true }: { post: PostView; showAuthor?: boolean }) {
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const initials = post.author.displayName.slice(0, 2).toUpperCase();
  const [liked, setLiked] = useState(post.viewerLiked);
  const [reactionCount, setReactionCount] = useState(post.counts.reactions);
  const [likePending, setLikePending] = useState(false);

  async function toggleLike(forceLike = false) {
    if (likePending) return;

    const nextLiked = forceLike ? true : !liked;
    if (nextLiked === liked) return;

    const previousLiked = liked;
    const previousCount = reactionCount;

    setLikePending(true);
    setLiked(nextLiked);
    setReactionCount((count) => count + (nextLiked ? 1 : -1));

    try {
      const res = await fetch(`/api/posts/${post.id}/reactions`, { method: "POST" });
      if (!res.ok) {
        setLiked(previousLiked);
        setReactionCount(previousCount);
        return;
      }

      const body = await res.json().catch(() => null);
      if (typeof body?.liked === "boolean") setLiked(body.liked);
      if (typeof body?.count === "number") setReactionCount(body.count);
    } catch {
      setLiked(previousLiked);
      setReactionCount(previousCount);
    } finally {
      setLikePending(false);
    }
  }

  return (
    <article className="-mx-3 flex flex-col gap-3 border-b border-border bg-card pb-3 md:mx-0 md:gap-3 md:rounded-xl md:border md:pb-4 md:shadow-card">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 md:px-4 md:pt-4">
        {showAuthor ? (
          <Link href={`/profile/${post.author.username}`} className="flex min-w-0 items-center gap-2.5">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={post.author.avatarUrl} alt={post.author.displayName} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{post.author.displayName}</p>
              <p className="text-xs text-muted-foreground">{timeAgo}</p>
            </div>
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          {post.isSubscriberOnly && (
            <Badge variant="tint" className="label-caps gap-1">
              <Lock className="h-3 w-3" aria-hidden="true" /> Premium
            </Badge>
          )}
          {post.lockReason === "premium_provider_limit" && (
            <Badge variant="outline" className="label-caps gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" /> Limit reached
            </Badge>
          )}
          {post.viewerCanManage ? (
            <PostOwnerControls
              postId={post.id}
              canEdit={post.viewerCanEdit}
              initialContent={post.content ?? ""}
              initialSubscriberOnly={post.isSubscriberOnly}
            />
          ) : (
            <ReportDialog targetType="post" targetId={post.id} label="Report post" variant="icon" />
          )}
        </div>
      </div>

      {post.locked ? (
        <div className="px-3 md:px-4">
          <LockedPostBody reason={post.lockReason} authorUsername={post.author.username} />
        </div>
      ) : (
        <>
          {/* Media is intentionally NOT wrapped in the card's own horizontal padding - it goes edge-to-edge on mobile, Instagram-style. */}
          <PostMediaCarousel media={post.mediaItems} liked={liked} onDoubleTapLike={() => toggleLike(true)} />
          {post.event && (
            <div className="px-3 md:px-4">
              <PostEventAttachment event={post.event} />
            </div>
          )}
          <div className="px-3 md:px-4">
            <PostActions
              postId={post.id}
              authorUsername={post.author.username}
              initialCounts={post.counts}
              initialViewerLiked={post.viewerLiked}
              liked={liked}
              reactionCount={reactionCount}
              onToggleLike={() => toggleLike()}
              likeDisabled={likePending}
            />
          </div>
          {post.content && <PostCaption content={post.content} />}
        </>
      )}
    </article>
  );
}
