import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Lock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ReportDialog } from "@/components/safety/report-dialog";
import { cn } from "@/lib/utils";
import type { PostView } from "@/lib/posts";

function LockedPostBody() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border/60">
      <div aria-hidden="true" className="select-none space-y-2 p-4 blur-sm">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
        <div className="mt-2 h-28 w-full rounded-lg bg-muted" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/70 px-4 text-center">
        <Lock className="h-6 w-6 text-neon-pink" aria-hidden="true" />
        <p className="text-sm font-medium">Subscribers only</p>
        <p className="text-xs text-muted-foreground">Subscribe to this creator to see this post.</p>
      </div>
    </div>
  );
}

export function PostCard({ post, showAuthor = true }: { post: PostView; showAuthor?: boolean }) {
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const initials = post.author.displayName.slice(0, 2).toUpperCase();

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        {showAuthor ? (
          <Link href={`/profile/${post.author.username}`} className="flex min-w-0 items-center gap-2">
            <Avatar className="h-9 w-9 border border-border">
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
        <div className="flex shrink-0 items-center gap-2">
          {post.isSubscriberOnly && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" /> Subscribers only
            </Badge>
          )}
          <ReportDialog targetType="post" targetId={post.id} label="Report post" variant="icon" />
        </div>
      </div>

      {post.locked ? (
        <LockedPostBody />
      ) : (
        <>
          {post.content && <p className="whitespace-pre-wrap text-sm">{post.content}</p>}
          {post.mediaUrls.length > 0 && (
            <div
              className={cn(
                "grid gap-1.5",
                post.mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
              )}
            >
              {post.mediaUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="aspect-square w-full rounded-lg border border-border/60 object-cover"
                />
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}
