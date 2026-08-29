import { Fragment } from "react";

import { PostCard } from "@/components/posts/post-card";
import { FeedPremiumGate } from "@/components/posts/feed-premium-gate";
import type { PostView } from "@/lib/posts";

type FeedItem =
  | { kind: "post"; post: PostView }
  | { kind: "premiumGate"; key: string; count: number };

/**
 * Collapses each run of consecutive provider posts the viewer has hit their
 * daily free-view limit on into one upsell, so the feed never becomes a wall
 * of identical paywall cards. Subscriber-only locks stay per-post (each is a
 * distinct creator the viewer can choose to subscribe to).
 */
function buildFeedItems(posts: PostView[]): FeedItem[] {
  const items: FeedItem[] = [];

  for (const post of posts) {
    if (post.locked && post.lockReason === "premium_provider_limit") {
      const last = items[items.length - 1];
      if (last && last.kind === "premiumGate") {
        last.count += 1;
      } else {
        items.push({ kind: "premiumGate", key: `gate-${post.id}`, count: 1 });
      }
      continue;
    }
    items.push({ kind: "post", post });
  }

  return items;
}

export function PostList({
  posts,
  emptyMessage,
  showAuthor = true,
}: {
  posts: PostView[];
  emptyMessage: string;
  showAuthor?: boolean;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground md:rounded-xl md:p-10">
        {emptyMessage}
      </div>
    );
  }

  const items = buildFeedItems(posts);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Fragment key={item.kind === "post" ? item.post.id : item.key}>
          {item.kind === "post" ? (
            <PostCard post={item.post} showAuthor={showAuthor} />
          ) : (
            <FeedPremiumGate count={item.count} />
          )}
        </Fragment>
      ))}
    </div>
  );
}
