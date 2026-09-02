"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceRing } from "@/components/ui/presence-avatar";
import { PostVideoPlayer } from "@/components/posts/post-video-player";
import type { PresenceStatus } from "@/lib/presence";
import { PostOwnerControls } from "@/components/posts/post-owner-controls";
import { ReportDialog } from "@/components/safety/report-dialog";
import { CommentComposer, CommentsList, usePostComments } from "@/components/posts/post-comments-shared";
import { VerificationBadge, type VerificationBadgeProfile } from "@/components/profile/verification-badge";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";
import type { PostMediaItem } from "@/lib/post-shared";

/** Instagram-style desktop split view: media on the left, post header/caption/comments on the right. */
export function PostDetailModal({
  open,
  onClose,
  postId,
  media,
  caption,
  createdAt,
  author,
  viewerCanManage,
  isSubscriberOnly,
  isPinned,
  liked,
  reactionCount,
  onToggleLike,
  likeDisabled = false,
  shareCount,
  onShare,
  commentCount,
  onCommentCountChange,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  media: PostMediaItem[];
  caption: string | null;
  createdAt: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string;
    presenceStatus: PresenceStatus;
    activeStreamId: string | null;
  } & VerificationBadgeProfile;
  viewerCanManage: boolean;
  isSubscriberOnly: boolean;
  isPinned: boolean;
  liked: boolean;
  reactionCount: number;
  onToggleLike: () => void;
  likeDisabled?: boolean;
  shareCount: number;
  onShare: () => void;
  commentCount: number;
  onCommentCountChange: (count: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef);

  const { comments, loadingInitial, loadingMore, loadError, sentinelRef, prependComment } = usePostComments(open, postId);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open, postId]);

  function handleReplyPosted(newCount?: number) {
    if (typeof newCount === "number") onCommentCountChange(newCount);
  }

  if (!open) return null;

  const activeMedia = media[activeIndex];
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  const initials = author.displayName.slice(0, 2).toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post and comments"
      className="fixed inset-0 z-[70] hidden items-center justify-center bg-black/85 p-6 md:flex"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed right-5 top-5 z-[71] flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
      >
        <X className="h-6 w-6" aria-hidden="true" />
      </button>

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex h-[min(85vh,760px)] w-full max-w-[935px] overflow-hidden rounded-xl bg-card shadow-2xl focus:outline-none"
      >
        <div className="relative hidden h-full flex-1 items-center justify-center bg-black md:flex">
          {activeMedia && (
            <>
              {activeMedia.type === "video" ? (
                <PostVideoPlayer
                  key={activeMedia.url}
                  src={activeMedia.url}
                  naturalWidth={activeMedia.width}
                  naturalHeight={activeMedia.height}
                  crop={activeMedia.crop}
                />
              ) : (
                <Image
                  src={activeMedia.url}
                  alt=""
                  fill
                  sizes="(min-width: 935px) 555px, 60vw"
                  className="object-contain"
                />
              )}
            </>
          )}

          {media.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous media"
                onClick={() => setActiveIndex((current) => (current - 1 + media.length) % media.length)}
                className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur hover:opacity-90"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next media"
                onClick={() => setActiveIndex((current) => (current + 1) % media.length)}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur hover:opacity-90"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="absolute right-3 top-3 rounded-full bg-background/85 px-2 py-1 text-xs font-semibold text-foreground backdrop-blur">
                {activeIndex + 1}/{media.length}
              </div>
            </>
          )}
        </div>

        <div className="flex h-full w-full flex-col md:w-[380px] md:shrink-0">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
            <Link
              href={
                author.presenceStatus === "live" && author.activeStreamId
                  ? `/live/${author.activeStreamId}`
                  : `/profile/${author.username}`
              }
              className="flex min-w-0 items-center gap-2.5"
            >
              <PresenceRing status={author.presenceStatus} size="h-9 w-9">
                <Avatar className="h-full w-full">
                  <AvatarImage src={author.avatarUrl} alt={author.displayName} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </PresenceRing>
              <div className="min-w-0">
                <p className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold">
                  <span className="truncate">@{author.username}</span>
                  <VerificationBadge profile={author} />
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo}</p>
              </div>
            </Link>
            {viewerCanManage ? (
              <PostOwnerControls
                postId={postId}
                initialContent={caption ?? ""}
                initialSubscriberOnly={isSubscriberOnly}
                isPinned={isPinned}
              />
            ) : (
              <ReportDialog targetType="post" targetId={postId} label="Report post" variant="icon" />
            )}
          </div>

          <div data-comments-scroll className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {caption && (
              <div className="mb-4 flex gap-2.5 border-b border-border pb-4">
                <Avatar className="h-9 w-9 shrink-0 border border-border">
                  <AvatarImage src={author.avatarUrl} alt={author.displayName} />
                  <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-[14.5px] leading-6">
                    <Link
                      href={`/profile/${author.username}`}
                      className="inline-flex items-center gap-1 font-semibold hover:text-primary"
                    >
                      @{author.username}
                      <VerificationBadge profile={author} />
                    </Link>{" "}
                    {caption}
                  </p>
                </div>
              </div>
            )}
            <CommentsList
              postId={postId}
              authorUsername={author.username}
              comments={comments}
              loadingInitial={loadingInitial}
              loadingMore={loadingMore}
              loadError={loadError}
              sentinelRef={sentinelRef}
              onReplyPosted={handleReplyPosted}
            />
          </div>

          <div className="shrink-0 border-t border-border px-4 pt-2.5">
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
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                {commentCount}
              </span>
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

          <CommentComposer
            postId={postId}
            onCommentPosted={(comment, count) => {
              prependComment(comment);
              if (typeof count === "number") onCommentCountChange(count);
            }}
          />
        </div>
      </div>
    </div>
  );
}
