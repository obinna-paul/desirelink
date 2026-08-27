"use client";

import { useRouter } from "next/navigation";

import { PostComposer } from "@/components/creator/post-composer";

export function FeedComposer({ displayName }: { displayName: string }) {
  const router = useRouter();

  function handleCreated() {
    router.refresh();
  }

  return <PostComposer creatorDisplayName={displayName} onCreated={handleCreated} />;
}
