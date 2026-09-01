"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Send, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ReportDialog } from "@/components/safety/report-dialog";
import { cn } from "@/lib/utils";
import type { PostCommentView } from "@/lib/posts";

export const QUICK_REACTIONS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];
const COMMENT_TRUNCATE_LENGTH = 220;

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function CommentText({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > COMMENT_TRUNCATE_LENGTH;
  const displayText = expanded || !isLong ? content : content.slice(0, COMMENT_TRUNCATE_LENGTH).trimEnd();

  return (
    <p className="mt-0.5 whitespace-pre-wrap text-[14.5px] leading-6 text-foreground">
      {displayText}
      {isLong && !expanded && "… "}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="font-semibold text-muted-foreground hover:text-foreground"
        >
          {expanded ? " See less" : "See more"}
        </button>
      )}
    </p>
  );
}

function CommentThread({
  postId,
  comment,
  authorUsername,
  onReplyPosted,
}: {
  postId: string;
  comment: PostCommentView;
  authorUsername: string;
  onReplyPosted: (newCount?: number) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repliesList, setRepliesList] = useState(comment.replies);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
  const isAuthor = comment.author.username === authorUsername;

  useEffect(() => {
    if (replying) replyInputRef.current?.focus();
  }, [replying]);

  async function submitReply(event: React.FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setPending(true);
    setError(null);

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply, parentId: comment.id }),
    });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't add reply.");
      return;
    }

    setReply("");
    setReplying(false);
    if (body?.comment) setRepliesList((current) => [...current, body.comment]);
    onReplyPosted(body?.count);
  }

  return (
    <li>
      <div className="flex gap-2.5">
        <Avatar
          className={cn(
            "h-9 w-9 shrink-0",
            isAuthor ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : "border border-border"
          )}
        >
          <AvatarImage src={comment.author.avatarUrl} alt={comment.author.displayName} />
          <AvatarFallback className="text-[11px]">{initials(comment.author.displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <Link
              href={`/profile/${comment.author.username}`}
              className="text-[13.5px] font-semibold hover:text-primary"
            >
              {comment.author.displayName}
            </Link>
            {isAuthor && (
              <Badge variant="tint" className="label-caps px-1.5 py-0 text-[9px] leading-4">
                Author
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          <CommentText content={comment.content} />

          <div className="mt-1 flex items-center gap-4 text-xs">
            <button
              type="button"
              className="font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => setReplying((value) => !value)}
            >
              Reply
            </button>
            <ReportDialog targetType="post_comment" targetId={comment.id} label="Report comment" variant="icon" />
          </div>

          {replying && (
            <form onSubmit={submitReply} className="mt-2 flex items-center gap-2">
              <input
                ref={replyInputRef}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                maxLength={1000}
                placeholder={`Reply to ${comment.author.displayName}...`}
                className="h-9 min-w-0 flex-1 rounded-full border border-border bg-muted px-3.5 text-sm outline-none focus-visible:border-primary/60"
              />
              <button
                type="submit"
                disabled={pending || !reply.trim()}
                aria-label="Post reply"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          )}
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}

          {repliesList.length > 0 && (
            <ul className="mt-3 flex flex-col gap-3">
              {repliesList.map((childComment) => (
                <CommentThread
                  key={childComment.id}
                  postId={postId}
                  comment={childComment}
                  authorUsername={authorUsername}
                  onReplyPosted={onReplyPosted}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

/** Shared data/pagination logic behind any comments view (mobile sheet or desktop split panel). */
export function usePostComments(open: boolean, postId: string) {
  const [comments, setComments] = useState<PostCommentView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const nextCursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLLIElement>(null);

  const loadPage = useCallback(
    async (cursor: string | null) => {
      const url = cursor
        ? `/api/posts/${postId}/comments?cursor=${encodeURIComponent(cursor)}`
        : `/api/posts/${postId}/comments`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load comments");
      return (await res.json()) as { comments: PostCommentView[]; nextCursor: string | null };
    },
    [postId]
  );

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingInitial(true);
    setLoadError(false);
    setComments([]);
    setNextCursor(null);

    loadPage(null)
      .then((data) => {
        if (cancelled) return;
        setComments(data.comments);
        setNextCursor(data.nextCursor);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !nextCursorRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    loadPage(nextCursorRef.current)
      .then((data) => {
        setComments((current) => [...current, ...data.comments]);
        setNextCursor(data.nextCursor);
      })
      .catch(() => {
        /* silently stop paginating on error; user can scroll again to retry */
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [loadPage]);

  useEffect(() => {
    if (!open) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: sentinel.closest("[data-comments-scroll]"), rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, loadMore, comments.length]);

  function prependComment(newComment: PostCommentView) {
    setComments((current) => [newComment, ...current]);
  }

  return { comments, loadingInitial, loadingMore, loadError, sentinelRef, prependComment };
}

/** Renders the loading/error/empty/list states for a comments feed - shared by the mobile sheet and desktop panel. */
export function CommentsList({
  postId,
  authorUsername,
  comments,
  loadingInitial,
  loadingMore,
  loadError,
  sentinelRef,
  onReplyPosted,
}: {
  postId: string;
  authorUsername: string;
  comments: PostCommentView[];
  loadingInitial: boolean;
  loadingMore: boolean;
  loadError: boolean;
  sentinelRef: React.RefObject<HTMLLIElement>;
  onReplyPosted: (newCount?: number) => void;
}) {
  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-1 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Couldn&apos;t load comments</p>
        <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-10 text-center">
        <p className="text-sm font-medium text-foreground">No comments yet</p>
        <p className="text-xs text-muted-foreground">Be the first to say something.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {comments.map((item) => (
        <CommentThread key={item.id} postId={postId} comment={item} authorUsername={authorUsername} onReplyPosted={onReplyPosted} />
      ))}
      <li ref={sentinelRef} aria-hidden="true" className="h-px" />
      {loadingMore && (
        <li className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        </li>
      )}
    </ul>
  );
}

/** Quick-reaction bar + comment input, identical between the mobile sheet and desktop panel. */
export function CommentComposer({
  postId,
  onCommentPosted,
}: {
  postId: string;
  onCommentPosted: (comment: PostCommentView, count?: number) => void;
}) {
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setPending(true);
    setError(null);

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't add comment.");
      return;
    }

    setComment("");
    if (body?.comment) onCommentPosted(body.comment, body?.count);
  }

  function insertReaction(emoji: string) {
    setComment((current) => `${current}${emoji}`);
    inputRef.current?.focus();
  }

  return (
    <div className="shrink-0 border-t border-border bg-card pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2.5">
      <div className="flex gap-2 overflow-x-auto px-4 pb-2.5">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => insertReaction(emoji)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg transition-colors hover:bg-accent-tint"
            aria-label={`Add ${emoji} to comment`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <form onSubmit={submitComment} className="flex items-center gap-2 px-4">
        <Avatar className="h-9 w-9 shrink-0 border border-border">
          <AvatarFallback className="bg-muted text-muted-foreground">
            <User className="h-4 w-4" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
        <input
          ref={inputRef}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1000}
          placeholder="Add a comment..."
          className="h-11 min-w-0 flex-1 rounded-full border border-border bg-muted px-4 text-sm outline-none focus-visible:border-primary/60"
        />
        <button
          type="submit"
          disabled={pending || !comment.trim()}
          aria-label="Post comment"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
      {error && <p className="mt-1.5 px-4 text-xs text-destructive">{error}</p>}
    </div>
  );
}
