import { PostCard } from "@/components/posts/post-card";
import type { PostView } from "@/lib/posts";

export function PostList({
  posts,
  emptyMessage,
  showAuthor = true,
  surface = "unknown",
}: {
  posts: PostView[];
  emptyMessage: string;
  showAuthor?: boolean;
  /** Passed through to each PostCard - see its own doc comment. */
  surface?: string;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground md:rounded-xl md:p-10">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((post, index) => (
        <PostCard key={post.id} post={post} showAuthor={showAuthor} surface={surface} position={index} />
      ))}
    </div>
  );
}
