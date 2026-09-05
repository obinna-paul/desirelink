"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff, ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BlockButton({
  profileId,
  initiallyBlocked,
  menu = false,
}: {
  profileId: string;
  initiallyBlocked: boolean;
  menu?: boolean;
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
    <div className={cn("flex flex-col gap-1", menu ? "w-full items-stretch" : "items-end")}>
      <Button
        type="button"
        variant={menu ? "ghost" : "outline"}
        size="sm"
        className={cn(
          "gap-1.5 text-destructive hover:text-destructive",
          menu && "min-h-11 w-full justify-start rounded-lg px-3 text-sm font-medium"
        )}
        disabled={pending}
        onClick={handleClick}
      >
        {blocked ? (
          <ShieldOff className={cn("h-3.5 w-3.5", menu && "h-4 w-4")} aria-hidden="true" />
        ) : (
          <ShieldX className={cn("h-3.5 w-3.5", menu && "h-4 w-4")} aria-hidden="true" />
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
