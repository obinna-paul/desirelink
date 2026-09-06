"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FollowButton({
  profileId,
  initiallyFollowing,
  className,
}: {
  profileId: string;
  initiallyFollowing: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);

    const res = following
      ? await fetch(`/api/follows/${profileId}`, { method: "DELETE" })
      : await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ followingId: profileId }),
        });

    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong. Try again.");
      return;
    }

    setFollowing((prev) => !prev);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={following ? "outline" : "default"}
        size="sm"
        className={cn("gap-1.5", className)}
        disabled={pending}
        onClick={handleClick}
      >
        {following ? (
          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {pending ? "..." : following ? "Following" : "Follow"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
