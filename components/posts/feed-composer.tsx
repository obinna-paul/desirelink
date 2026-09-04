"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PostComposer } from "@/components/creator/post-composer";
import { PublishToast } from "@/components/ui/publish-toast";
import type { PostView } from "@/lib/posts";

const CONFIRMATION_TIMEOUT_MS = 5000;

export function FeedComposer({
  displayName,
  canPostPremiumContent = false,
  hasIdentityOnFile = false,
  hasPricingTier = false,
}: {
  displayName: string;
  canPostPremiumContent?: boolean;
  hasIdentityOnFile?: boolean;
  hasPricingTier?: boolean;
}) {
  const router = useRouter();
  const [justPublished, setJustPublished] = useState<PostView | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCreated(post: PostView) {
    router.refresh();
    setJustPublished(post);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setJustPublished(null), CONFIRMATION_TIMEOUT_MS);
  }

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {justPublished && (
        <PublishToast
          message={`Posted${justPublished.isSubscriberOnly ? " to your Premium tab" : ""}.`}
          actionLabel="View in feed"
          actionHref="/"
        />
      )}
      <PostComposer
        creatorDisplayName={displayName}
        canPostPremiumContent={canPostPremiumContent}
        hasIdentityOnFile={hasIdentityOnFile}
        hasPricingTier={hasPricingTier}
        onCreated={handleCreated}
      />
    </div>
  );
}
