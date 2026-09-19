"use client";

import { useState } from "react";
import { Check, HeartHandshake, Scale, Sparkles } from "lucide-react";

import { MATCH_PRIORITY_OPTIONS, type MatchPriorityValue } from "@/lib/match-priority";
import { cn } from "@/lib/utils";

const ICONS = {
  BALANCED: Scale,
  SPARK: Sparkles,
  PARTNERSHIP: HeartHandshake,
} as const;

export function MatchPriorityPicker({ initialPriority }: { initialPriority: MatchPriorityValue }) {
  const [priority, setPriority] = useState(initialPriority);
  const [saving, setSaving] = useState<MatchPriorityValue | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  async function choose(nextPriority: MatchPriorityValue) {
    if (saving) return;

    const previous = priority;
    setPriority(nextPriority);
    setSaving(nextPriority);
    setMessage("");
    setMessageType(null);

    try {
      const response = await fetch("/api/profile/match-priority", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: nextPriority }),
      });
      if (!response.ok) throw new Error("Unable to save match priority");
      setMessage("Your recommendations are tuned.");
      setMessageType("success");
    } catch {
      setPriority(previous);
      setMessage("We couldn’t save that yet. Please try again.");
      setMessageType("error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card" aria-labelledby="match-priority-title">
      <div className="text-center">
        <h2 id="match-priority-title" className="font-heading text-xl font-bold">What would you like more of?</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          This tunes Recommended results. You can change it later in Discover filters.
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Match priority">
        {MATCH_PRIORITY_OPTIONS.map((option) => {
          const selected = priority === option.value;
          const Icon = ICONS[option.value];
          const isSaving = saving === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={Boolean(saving)}
              onClick={() => choose(option.value)}
              className={cn(
                "relative min-h-28 rounded-xl border p-4 text-left transition-[background-color,border-color,box-shadow,transform] active:scale-[0.99] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70",
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-background hover:border-primary/40 hover:bg-accent/40",
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <Icon className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                {selected && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
              </span>
              <span className="mt-3 block text-sm font-bold text-foreground">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {isSaving ? "Saving…" : option.description}
              </span>
            </button>
          );
        })}
      </div>
      <p
        className={cn(
          "mt-3 min-h-5 text-center text-xs",
          messageType === "error" ? "font-medium text-destructive" : "text-muted-foreground",
        )}
        role={messageType === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {message}
      </p>
    </section>
  );
}
