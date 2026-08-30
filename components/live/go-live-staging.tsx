"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PreJoin, type LocalUserChoices } from "@livekit/components-react";

export function GoLiveStaging({ defaultTitle, hostName }: { defaultTitle: string; hostName: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(choices: LocalUserChoices) {
    setPending(true);
    setError(null);
    const res = await fetch("/api/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't start your stream.");
      return;
    }

    const cam = choices.videoEnabled ? "1" : "0";
    const mic = choices.audioEnabled ? "1" : "0";
    router.push(`/live/${body.stream.id}?cam=${cam}&mic=${mic}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stream-title" className="text-sm font-medium text-foreground">
          Stream title
        </label>
        <input
          id="stream-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={defaultTitle}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div data-lk-theme="default" className="overflow-hidden rounded-2xl border border-border/60">
        <PreJoin
          defaults={{ username: hostName, videoEnabled: true, audioEnabled: true }}
          joinLabel={pending ? "Starting…" : "Go live"}
          onSubmit={handleSubmit}
          onError={(err) => setError(err.message)}
          persistUserChoices={false}
        />
      </div>
    </div>
  );
}
