"use client";

import { useRouter } from "next/navigation";

import { PostComposer } from "@/components/creator/post-composer";

export function FeedComposer({ displayName, isProvider }: { displayName: string; isProvider: boolean }) {
  const router = useRouter();

  function handleCreated() {
    router.refresh();
  }

  return <PostComposer creatorDisplayName={displayName} isProvider={isProvider} onCreated={handleCreated} />;
}
