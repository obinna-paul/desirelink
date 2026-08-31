"use client";

import { useRouter } from "next/navigation";

import { PostComposer } from "@/components/creator/post-composer";

export function FeedComposer({
  displayName,
  allowPremiumContent = false,
}: {
  displayName: string;
  allowPremiumContent?: boolean;
}) {
  const router = useRouter();

  function handleCreated() {
    router.refresh();
  }

  return (
    <PostComposer
      creatorDisplayName={displayName}
      allowPremiumContent={allowPremiumContent}
      onCreated={handleCreated}
    />
  );
}
