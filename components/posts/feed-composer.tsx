"use client";

import { useRouter } from "next/navigation";

import { PostComposer } from "@/components/creator/post-composer";

export function FeedComposer({
  displayName,
  canPostPremiumContent = false,
}: {
  displayName: string;
  canPostPremiumContent?: boolean;
}) {
  const router = useRouter();

  function handleCreated() {
    router.refresh();
  }

  return (
    <PostComposer
      creatorDisplayName={displayName}
      canPostPremiumContent={canPostPremiumContent}
      onCreated={handleCreated}
    />
  );
}
