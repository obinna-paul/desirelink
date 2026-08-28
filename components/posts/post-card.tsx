import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Lock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PostActions } from "@/components/posts/post-actions";
import { PostEventAttachment } from "@/components/posts/post-event-attachment";
import { PostMediaCarousel } from "@/components/posts/post-media-carousel";
import { PostOwnerControls } from "@/components/posts/post-owner-controls";
import { ReportDialog } from "@/components/safety/report-dialog";
import type { PostView } from "@/lib/posts";

function LockedPostBody({ reason }: { reason: PostView["lockReason"] }) {
  const isPremiumLimit = reason === "premium_provider_limit";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 md:rounded-lg">
      <div aria-hidden="true" className="select-none space-y-2 p-4 blur-sm">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
        <div className="mt-2 h-28 w-full rounded-lg bg-muted" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/78 px-4 text-center backdrop-blur-sm">
        <Lock className="h-6 w-6 text-neon-pink" aria-hidden="true" />
        <p className="text-sm font-medium">{isPremiumLimit ? "Premium access" : "Fans only"}</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {isPremiumLimit
            ? "Free accounts can view 5 free provider posts per day. Upgrade for unlimited provider content."
            : "Subscribe to this creator to see this post."}
        </p>
        {isPremiumLimit && (
          <Button asChild size="sm" className="mt-1">
            <Link href="/settings/billing">Upgrade</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function PostCard({ post, showAuthor = true }: { post: PostView; showAuthor?: boolean }) {
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const initials = post.author.displayName.slice(0, 2).toUpperCase();

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm md:rounded-xl md:p-4 md:shadow-card">
      <div className="flex items-center justify-between gap-2">
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
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" /> Fans only
            </Badge>
          )}
          {post.lockReason === "premium_provider_limit" && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" /> premium
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
        <LockedPostBody reason={post.lockReason} />
      ) : (
        <>
          {post.content && <p className="whitespace-pre-wrap text-sm leading-6">{post.content}</p>}
          <PostMediaCarousel media={post.mediaItems} />
          {post.event && <PostEventAttachment event={post.event} />}
          <PostActions
            postId={post.id}
            authorUsername={post.author.username}
            initialCounts={post.counts}
            initialViewerLiked={post.viewerLiked}
            initialComments={post.comments}
          />
        </>
      )}
    </article>
  );
}
