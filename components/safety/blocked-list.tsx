"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { BlockedProfileData } from "@/lib/block";

export function BlockedList({ initialBlocks }: { initialBlocks: BlockedProfileData[] }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initialBlocks);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUnblock(blockedId: string) {
    setUnblockingId(blockedId);
    setError(null);

    const res = await fetch(`/api/blocks/${blockedId}`, { method: "DELETE" });
    setUnblockingId(null);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't unblock this user. Try again.");
      return;
    }

    setBlocks((prev) => prev.filter((block) => block.blocked.id !== blockedId));
    router.refresh();
  }

  if (blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
        You haven&apos;t blocked anyone.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {blocks.map(({ blocked, createdAt }) => {
          const initials = blocked.displayName.slice(0, 2).toUpperCase();
          return (
            <li
              key={blocked.id}
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between md:rounded-lg md:shadow-none"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src={blocked.avatarUrl} alt={blocked.displayName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{blocked.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {blocked.username} &middot; Blocked {new Date(createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full shrink-0 sm:w-auto"
                disabled={unblockingId === blocked.id}
                onClick={() => handleUnblock(blocked.id)}
              >
                {unblockingId === blocked.id ? "Unblocking..." : "Unblock"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
