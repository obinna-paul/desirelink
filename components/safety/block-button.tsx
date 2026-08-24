"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff, ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BlockButton({
  profileId,
  initiallyBlocked,
}: {
  profileId: string;
  initiallyBlocked: boolean;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (blocked) {
      if (!window.confirm("Unblock this user? They'll be able to message and view your profile again.")) {
        return;
      }
    } else if (!window.confirm("Block this user? They won't be able to message or view your profile.")) {
      return;
    }

    setPending(true);
    setError(null);

    const res = blocked
      ? await fetch(`/api/blocks/${profileId}`, { method: "DELETE" })
      : await fetch("/api/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockedId: profileId }),
        });

    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong. Try again.");
      return;
    }

    setBlocked((prev) => !prev);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-destructive hover:text-destructive"
        disabled={pending}
        onClick={handleClick}
      >
        {blocked ? (
          <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ShieldX className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {pending ? "..." : blocked ? "Unblock" : "Block"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
