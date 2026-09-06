"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TopicOption } from "@/lib/topics";

export function InterestsPickerForm({ topics }: { topics: TopicOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  function toggle(topicId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }

  async function submit(topicIds: string[]) {
    setServerError(null);
    setStatus("submitting");

    const res = await fetch("/api/profile/interests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicIds }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus("idle");
      setServerError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => {
          const isSelected = selected.has(topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => toggle(topic.id)}
              aria-pressed={isSelected}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-transparent text-foreground hover:border-primary/60 hover:bg-accent-tint/70",
              )}
            >
              {topic.name}
            </button>
          );
        })}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={status === "submitting"}
          onClick={() => submit([])}
          className="h-11"
        >
          Skip for now
        </Button>
        <Button
          type="button"
          disabled={status === "submitting"}
          onClick={() => submit(Array.from(selected))}
          className="h-11 min-w-32"
        >
          {status === "submitting" ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
