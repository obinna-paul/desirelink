import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { getCreatorPosts } from "@/lib/creator";

type Posts = Awaited<ReturnType<typeof getCreatorPosts>>;

export function ContentList({ posts }: { posts: Posts }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
        <div>
          <p className="text-sm font-medium">Post creation is coming soon</p>
          <p className="text-xs text-muted-foreground">
            You&apos;ll be able to publish text, photo, and subscriber-only posts from here.
          </p>
        </div>
        <Button type="button" disabled>
          Create post
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          You haven&apos;t published anything yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {post.createdAt.toLocaleDateString()}
                </span>
                {post.isSubscriberOnly && (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" aria-hidden="true" /> Subscribers only
                  </Badge>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{post.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
