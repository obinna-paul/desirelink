"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Reply, Send, Share2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportDialog } from "@/components/safety/report-dialog";
import { cn } from "@/lib/utils";
import type { PostCommentView } from "@/lib/posts";

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function CommentItem({
  postId,
  comment,
  onReplyCreated,
}: {
  postId: string;
  comment: PostCommentView;
  onReplyCreated: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

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
    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't add reply.");
      return;
    }

    setReply("");
    setReplying(false);
    onReplyCreated();
  }

  return (
    <li className="flex gap-2.5">
      <Avatar className="h-8 w-8 shrink-0 border border-border">
        <AvatarImage src={comment.author.avatarUrl} alt={comment.author.displayName} />
        <AvatarFallback className="text-[10px]">{initials(comment.author.displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-secondary/50 px-3 py-2">
          <Link href={`/profile/${comment.author.username}`} className="text-sm font-semibold hover:text-primary">
            {comment.author.displayName}
          </Link>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">{comment.content}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 px-1 text-xs text-muted-foreground">
          <span>{timeAgo}</span>
          <button type="button" className="font-semibold hover:text-foreground" onClick={() => setReplying((value) => !value)}>
            Reply
          </button>
          <ReportDialog targetType="post_comment" targetId={comment.id} label="Report comment" variant="icon" />
        </div>

        {comment.replies.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {comment.replies.map((replyComment) => (
              <CommentItem
                key={replyComment.id}
                postId={postId}
                comment={replyComment}
                onReplyCreated={onReplyCreated}
              />
            ))}
          </ul>
        )}

        {replying && (
          <form onSubmit={submitReply} className="mt-2 flex gap-2">
            <Textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              maxLength={1000}
              rows={1}
              placeholder="Reply..."
              className="min-h-10 flex-1 resize-none rounded-2xl text-sm"
            />
            <Button type="submit" size="icon" disabled={pending || !reply.trim()} aria-label="Post reply">
              <Reply className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </li>
  );
}

export function PostActions({
  postId,
  authorUsername,
  initialCounts,
  initialViewerLiked,
  initialComments,
}: {
  postId: string;
  authorUsername: string;
  initialCounts: { reactions: number; comments: number; shares: number };
  initialViewerLiked: boolean;
  initialComments: PostCommentView[];
}) {
  const [liked, setLiked] = useState(initialViewerLiked);
  const [reactionCount, setReactionCount] = useState(initialCounts.reactions);
  const [commentCount, setCommentCount] = useState(initialCounts.comments);
  const [shareCount, setShareCount] = useState(initialCounts.shares);
  const [comments, setComments] = useState(initialComments);
  const [commentsOpen, setCommentsOpen] = useState(initialComments.length > 0);
  const [comment, setComment] = useState("");
  const [pendingComment, setPendingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setPendingComment(true);
    setError(null);

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    });
    const body = await res.json().catch(() => null);
    setPendingComment(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't add comment.");
      return;
    }

    setComment("");
    setComments((current) => [body.comment, ...current]);
    setCommentCount(body.count ?? commentCount + 1);
    setCommentsOpen(true);
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
          onClick={() => setCommentsOpen((value) => !value)}
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

      {commentsOpen && (
        <div className="flex flex-col gap-3">
          <form onSubmit={submitComment} className="flex gap-2">
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              rows={1}
              placeholder="Add a comment..."
              className="min-h-11 flex-1 resize-none rounded-2xl text-sm"
            />
            <Button type="submit" size="icon" disabled={pendingComment || !comment.trim()} aria-label="Post comment">
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {comments.length > 0 && (
            <ul className="flex flex-col gap-3">
              {comments.map((item) => (
                <CommentItem
                  key={item.id}
                  postId={postId}
                  comment={item}
                  onReplyCreated={() => setCommentCount((count) => count + 1)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
