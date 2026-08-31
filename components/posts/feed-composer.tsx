"use client";

import { useRouter } from "next/navigation";

import { PostComposer } from "@/components/creator/post-composer";

export function FeedComposer({
  displayName,
  canPostPremiumContent = false,
  hasIdentityOnFile = false,
}: {
  displayName: string;
  canPostPremiumContent?: boolean;
  hasIdentityOnFile?: boolean;
}) {
  const router = useRouter();

  function handleCreated() {
    router.refresh();
  }

  return (
    <PostComposer
      creatorDisplayName={displayName}
      canPostPremiumContent={canPostPremiumContent}
      hasIdentityOnFile={hasIdentityOnFile}
      onCreated={handleCreated}
    />
  );
}
