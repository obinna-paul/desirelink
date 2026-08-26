"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RoomPostData } from "@/lib/rooms";

export function RoomPostComposer({
  roomId,
  onCreated,
}: {
  roomId: string;
  onCreated: (post: RoomPostData) => void;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) {
      setError("Write something first.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/rooms/${roomId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't post. Try again.");
      return;
    }

    setContent("");
    onCreated(body.post);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm md:rounded-xl md:p-4 md:shadow-none">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share something with the room..."
        rows={3}
        maxLength={3000}
        className="min-h-24 resize-none rounded-2xl text-base md:text-sm"
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting || !content.trim()} className="w-full md:w-auto">
          {submitting ? "Posting..." : "Post"}
        </Button>
      </div>
    </form>
  );
}
