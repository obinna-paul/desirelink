"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Send, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ReportDialog } from "@/components/safety/report-dialog";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";
import type { PostCommentView } from "@/lib/posts";

const QUICK_REACTIONS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];
const CLOSE_ANIMATION_MS = 240;
const DRAG_DISMISS_THRESHOLD = 110;

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function countReplies(comments: PostCommentView[]): number {
  return comments.reduce((total, item) => total + 1 + countReplies(item.replies), 0);
}

function CommentThread({
  postId,
  comment,
  authorUsername,
  depth = 0,
  onReplyPosted,
}: {
  postId: string;
  comment: PostCommentView;
  authorUsername: string;
  depth?: number;
  onReplyPosted: (newCount: number) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repliesExpanded, setRepliesExpanded] = useState(depth > 0);
  const [repliesList, setRepliesList] = useState(comment.replies);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
  const isAuthor = comment.author.username === authorUsername;
  const replyCount = countReplies(repliesList);

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
    setRepliesExpanded(true);
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
          <p className="mt-0.5 whitespace-pre-wrap text-[14.5px] leading-6 text-foreground">{comment.content}</p>

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

          {repliesList.length > 0 && !repliesExpanded && (
            <button
              type="button"
              onClick={() => setRepliesExpanded(true)}
              className="mt-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <span className="h-px w-6 bg-border" aria-hidden="true" />
              View {replyCount} more {replyCount === 1 ? "reply" : "replies"}
            </button>
          )}

          {repliesList.length > 0 && repliesExpanded && (
            <ul className="mt-3 flex flex-col gap-3">
              {repliesList.map((childComment) => (
                <CommentThread
                  key={childComment.id}
                  postId={postId}
                  comment={childComment}
                  authorUsername={authorUsername}
                  depth={depth + 1}
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

export function CommentsSheet({
  open,
  onClose,
  postId,
  authorUsername,
  comments,
  onNewComment,
  onNewReply,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  authorUsername: string;
  comments: PostCommentView[];
  onNewComment: (comment: PostCommentView, newCount: number) => void;
  onNewReply: (newCount: number) => void;
}) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragState = useRef<{ startY: number; dragging: boolean } | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(open, sheetRef);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    if (rendered) {
      setVisible(false);
      const timeout = setTimeout(() => setRendered(false), CLOSE_ANIMATION_MS);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!rendered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rendered]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function handleDragStart(event: React.PointerEvent) {
    dragState.current = { startY: event.clientY, dragging: true };
  }

  function handleDragMove(event: React.PointerEvent) {
    if (!dragState.current?.dragging) return;
    const delta = event.clientY - dragState.current.startY;
    setDragOffset(Math.max(0, delta));
  }

  function handleDragEnd() {
    if (!dragState.current) return;
    dragState.current.dragging = false;
    if (dragOffset > DRAG_DISMISS_THRESHOLD) {
      onClose();
    }
    setDragOffset(0);
  }

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
    onNewComment(body.comment, body.count ?? comments.length + 1);
  }

  function insertReaction(emoji: string) {
    setComment((current) => `${current}${emoji}`);
    inputRef.current?.focus();
  }

  function handleReplyPosted(newCount?: number) {
    onNewReply(newCount ?? countReplies(comments) + comments.length + 1);
  }

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-50" aria-hidden={!open}>
      <div
        className={cn(
          "absolute inset-0 bg-foreground/45 backdrop-blur-[1px] transition-opacity motion-reduce:transition-none",
          visible ? "opacity-100 duration-300" : "opacity-0 duration-200"
        )}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[86vh] flex-col overflow-hidden rounded-t-[22px] bg-card shadow-lift transition-transform motion-reduce:transition-none",
          visible ? "translate-y-0 duration-300 ease-out" : "translate-y-full duration-200 ease-in"
        )}
        style={dragState.current?.dragging ? { transform: `translateY(${dragOffset}px)`, transition: "none" } : undefined}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-2 pt-2.5 active:cursor-grabbing"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <span className="h-1 w-9 rounded-full bg-border" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center justify-center border-b border-border px-4 pb-3">
          <p className="font-heading text-[15px] italic font-semibold">Comments</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No comments yet</p>
              <p className="text-xs text-muted-foreground">Be the first to say something.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {comments.map((item) => (
                <CommentThread
                  key={item.id}
                  postId={postId}
                  comment={item}
                  authorUsername={authorUsername}
                  onReplyPosted={handleReplyPosted}
                />
              ))}
            </ul>
          )}
        </div>

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
      </div>
    </div>
  );
}
