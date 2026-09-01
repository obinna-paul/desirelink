"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MembershipState } from "@/lib/rooms";

export function JoinButton({
  roomId,
  initialState,
  isPrivate,
}: {
  roomId: string;
  initialState: MembershipState;
  isPrivate: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setPending(true);
    setError(null);

    const res = await fetch(`/api/rooms/${roomId}/join`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't join this room. Try again.");
      return;
    }

    setState(body.state === "pending" ? "pending" : "member");
    router.refresh();
  }

  if (state === "admin") {
    return (
      <Button variant="outline" disabled className="w-full gap-1.5 md:w-auto">
        <Sparkles className="h-4 w-4" aria-hidden="true" /> Admin
      </Button>
    );
  }

  if (state === "member") {
    return (
      <Button variant="outline" disabled className="w-full gap-1.5 md:w-auto">
        <Check className="h-4 w-4" aria-hidden="true" /> Member
      </Button>
    );
  }

  if (state === "pending") {
    return (
      <Button variant="outline" disabled className="w-full gap-1.5 md:w-auto">
        <Clock className="h-4 w-4" aria-hidden="true" /> Request pending
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 md:w-auto md:items-end">
      <Button type="button" onClick={handleJoin} disabled={pending}>
        {pending ? "..." : isPrivate ? "Request to join" : "Join"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
