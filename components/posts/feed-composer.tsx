"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { PostComposer } from "@/components/creator/post-composer";
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
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-trust/40 bg-trust/10 px-4 py-3 text-sm"
        >
          <span className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-trust" aria-hidden="true" />
            Posted{justPublished.isSubscriberOnly ? " to your Premium tab" : ""}.
          </span>
          <Link href="/" className="shrink-0 font-medium text-primary hover:underline">
            View in feed
          </Link>
        </div>
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
