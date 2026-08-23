"use client";

import { useState } from "react";

import { PostComposer } from "@/components/creator/post-composer";
import { PostList } from "@/components/posts/post-list";
import type { PostView } from "@/lib/posts";

export function ContentList({ initialPosts }: { initialPosts: PostView[] }) {
  const [posts, setPosts] = useState(initialPosts);

  return (
    <div className="flex flex-col gap-4">
      <PostComposer onCreated={(post) => setPosts((prev) => [post, ...prev])} />
      <PostList
        posts={posts}
        showAuthor={false}
        emptyMessage="You haven't published anything yet."
      />
    </div>
  );
}
