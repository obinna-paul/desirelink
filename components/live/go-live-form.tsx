"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GoLiveForm({ defaultTitle }: { defaultTitle: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoLive() {
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

    router.push(`/live/${body.stream.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stream-title" className="text-sm font-medium">
          Stream title
        </label>
        <Input
          id="stream-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={defaultTitle}
        />
      </div>
      <Button type="button" size="lg" disabled={pending} onClick={handleGoLive}>
        {pending ? "Starting…" : "Go live"}
      </Button>
    </div>
  );
}
