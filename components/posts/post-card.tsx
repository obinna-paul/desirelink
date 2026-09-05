"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Eye, Lock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceRing } from "@/components/ui/presence-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommentsSheet } from "@/components/posts/comments-sheet";
import { PostActions } from "@/components/posts/post-actions";
import { PostCaption } from "@/components/posts/post-caption";
import { PostDetailModal } from "@/components/posts/post-detail-modal";
import { PostMediaCarousel } from "@/components/posts/post-media-carousel";
import { PostOwnerControls } from "@/components/posts/post-owner-controls";
import { PostSubscribeChip } from "@/components/posts/post-subscribe-chip";
import { SubscribePlansDialog } from "@/components/profile/subscribe-plans-dialog";
import { ReportDialog } from "@/components/safety/report-dialog";
import { VerificationBadge } from "@/components/profile/verification-badge";
import type { PostView } from "@/lib/posts";

function LockedPostBody({
  postId,
  authorUsername,
  blurredPreview,
  subscribePrompt,
}: {
  postId: string;
  authorUsername: string;
  blurredPreview: PostView["blurredPreview"];
  subscribePrompt: PostView["subscribePrompt"];
}) {
  return (
    <div className="relative flex min-h-[26rem] flex-col items-center justify-center gap-2 overflow-hidden bg-foreground px-6 text-center text-background">
      {blurredPreview && (
        <Image
          src={blurredPreview.url}
          alt=""
          fill
          sizes="100vw"
          className={blurredPreview.cssBlur ? "object-cover blur-xl scale-110" : "object-cover"}
        />
      )}
      <div className="absolute inset-0 bg-foreground/70" />

      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background/10">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="font-heading text-lg italic font-medium">Subscriber exclusive</p>
        <p className="max-w-xs text-sm text-background/70">
          Subscribe to see this premium post and many more
        </p>

        <div className="mt-2 flex flex-col items-center gap-2">
          {subscribePrompt && subscribePrompt.tiers.length > 0 ? (
            <SubscribePlansDialog
              providerId={subscribePrompt.providerId}
              tiers={subscribePrompt.tiers}
              conversionPostId={postId}
              renderTrigger={({ onClick }) => (
                <Button type="button" size="sm" onClick={onClick}>
                  Subscribe now
                </Button>
              )}
            />
          ) : (
            <Button asChild size="sm">
              <Link href={`/profile/${authorUsername}`}>Subscribe now</Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-background/40 bg-transparent text-background hover:bg-background/10"
          >
            <Link href={`/profile/${authorUsername}?section=posts`}>See my free content</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PostCard({
  post,
  showAuthor = true,
}: {
  post: PostView;
  showAuthor?: boolean;
}) {
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
  });
  const initials = post.author.displayName.slice(0, 2).toUpperCase();
  const [liked, setLiked] = useState(post.viewerLiked);
  const [reactionCount, setReactionCount] = useState(post.counts.reactions);
  const [likePending, setLikePending] = useState(false);
  const [commentCount, setCommentCount] = useState(post.counts.comments);
  const [shareCount, setShareCount] = useState(post.counts.shares);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/posts/${post.id}`;
    return `${window.location.origin}/posts/${post.id}`;
  }, [post.id]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  async function sharePost() {
    const canShare = typeof navigator !== "undefined" && "share" in navigator;
    if (canShare) {
      await navigator.share({ title: "Udala post", url: shareUrl }).catch(() => null);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl).catch(() => null);
    }

    const res = await fetch(`/api/posts/${post.id}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: canShare ? "web_share" : "copy_link" }),
    });
    const body = await res.json().catch(() => null);
    if (typeof body?.count === "number") setShareCount(body.count);
  }

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
      const res = await fetch(`/api/posts/${post.id}/reactions`, {
        method: "POST",
      });
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
    <article className="-mx-3 flex flex-col gap-3 bg-card pb-3 md:mx-0 md:gap-3 md:rounded-xl md:border md:pb-4 md:shadow-card">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 md:px-4 md:pt-4">
        {showAuthor ? (
          <Link
            href={
              post.author.presenceStatus === "live" && post.author.activeStreamId
                ? `/live/${post.author.activeStreamId}`
                : `/profile/${post.author.username}`
            }
            className="flex min-w-0 items-center gap-2.5"
          >
            <PresenceRing status={post.author.presenceStatus} size="h-10 w-10">
              <Avatar className="h-full w-full">
                <AvatarImage
                  src={post.author.avatarUrl}
                  alt={post.author.displayName}
                />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </PresenceRing>
            <div className="min-w-0">
              <p className="flex min-w-0 items-center gap-1 truncate text-sm font-medium">
                <span className="truncate">{post.author.username}</span>
                <VerificationBadge profile={post.author} />
              </p>
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
          {post.viewerCanManage ? (
            <PostOwnerControls
              postId={post.id}
              initialContent={post.content ?? ""}
              initialSubscriberOnly={post.isSubscriberOnly}
              isPinned={post.isPinned}
            />
          ) : (
            <ReportDialog
              targetType="post"
              targetId={post.id}
              label="Report post"
              variant="icon"
            />
          )}
        </div>
      </div>

      {/* subscribePrompt is also populated on a locked post (to drive LockedPostBody's own
          Subscribe now button below) - the lead-magnet chip is only for a free post. */}
      {post.subscribePrompt && !post.locked && (
        <div className="px-3 md:px-4">
          <PostSubscribeChip prompt={post.subscribePrompt} />
        </div>
      )}

      {post.locked ? (
        // Full-bleed, matching the media carousel's own edge-to-edge treatment below.
        <LockedPostBody
          postId={post.id}
          authorUsername={post.author.username}
          blurredPreview={post.blurredPreview}
          subscribePrompt={post.subscribePrompt}
        />
      ) : (
        <>
          {/* Media is intentionally NOT wrapped in the card's own horizontal padding - it goes edge-to-edge on mobile, Instagram-style. */}
          <PostMediaCarousel
            media={post.mediaItems}
            liked={liked}
            onDoubleTapLike={() => toggleLike(true)}
          />
          <div className="flex items-center gap-1.5 px-3 pt-2 text-xs text-muted-foreground md:px-4">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {post.viewCount.toLocaleString()}{" "}
              {post.viewCount === 1 ? "view" : "views"}
            </span>
          </div>
          <div className="px-3 md:px-4">
            <PostActions
              liked={liked}
              reactionCount={reactionCount}
              commentCount={commentCount}
              shareCount={shareCount}
              onToggleLike={() => toggleLike()}
              onOpenComments={() => setDetailOpen(true)}
              onShare={sharePost}
              likeDisabled={likePending}
            />
          </div>
          {post.content && <PostCaption content={post.content} />}

          <CommentsSheet
            open={detailOpen && (!isDesktop || post.mediaItems.length === 0)}
            onClose={() => setDetailOpen(false)}
            postId={post.id}
            authorUsername={post.author.username}
            onCommentCountChange={setCommentCount}
          />
          <PostDetailModal
            open={detailOpen && isDesktop && post.mediaItems.length > 0}
            onClose={() => setDetailOpen(false)}
            postId={post.id}
            media={post.mediaItems}
            caption={post.content}
            createdAt={post.createdAt}
            author={post.author}
            viewerCanManage={post.viewerCanManage}
            isSubscriberOnly={post.isSubscriberOnly}
            isPinned={post.isPinned}
            liked={liked}
            reactionCount={reactionCount}
            onToggleLike={() => toggleLike()}
            likeDisabled={likePending}
            shareCount={shareCount}
            onShare={sharePost}
            commentCount={commentCount}
            onCommentCountChange={setCommentCount}
          />
        </>
      )}
    </article>
  );
}
