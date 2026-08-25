"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ReviewableContext } from "@/lib/reviews";

function contextKey(context: ReviewableContext) {
  return `${context.contextType}:${context.contextId}`;
}

export function ReviewDialog({
  revieweeId,
  revieweeName,
  contexts,
}: {
  revieweeId: string;
  revieweeName: string;
  contexts: ReviewableContext[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState(contexts[0] ? contextKey(contexts[0]) : "");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      if (submitted) router.refresh();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, submitted, router]);

  if (contexts.length === 0) return null;

  function openDialog() {
    setSelectedKey(contexts[0] ? contextKey(contexts[0]) : "");
    setRating(5);
    setComment("");
    setError(null);
    setSubmitted(false);
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const selected = contexts.find((c) => contextKey(c) === selectedKey);
    if (!selected) {
      setError("Choose what you're reviewing");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revieweeId,
        contextType: selected.contextType,
        contextId: selected.contextId,
        rating,
        comment,
      }),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't submit your review. Try again.");
      return;
    }

    setSubmitted(true);
  }

  function closeDialog() {
    setOpen(false);
    if (submitted) router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openDialog}>
        Leave a review
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border/60 bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="review-dialog-title" className="text-sm font-semibold">
                Review {revieweeName}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeDialog}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-sm font-medium">Review submitted</p>
                <p className="text-xs text-muted-foreground">Thanks for sharing your experience.</p>
                <Button type="button" size="sm" onClick={closeDialog}>
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                {contexts.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="review-context" className="text-xs font-medium text-muted-foreground">
                      What are you reviewing?
                    </label>
                    <Select
                      id="review-context"
                      value={selectedKey}
                      onChange={(e) => setSelectedKey(e.target.value)}
                    >
                      {contexts.map((context) => (
                        <option key={contextKey(context)} value={contextKey(context)}>
                          {context.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Rating</span>
                  <div className="flex gap-1" role="radiogroup" aria-label="Rating out of 5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={rating === value}
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                        onClick={() => setRating(value)}
                        onMouseEnter={() => setHoverRating(value)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="flex h-11 w-11 items-center justify-center"
                      >
                        <Star
                          className={cn(
                            "h-6 w-6 transition-colors",
                            (hoverRating || rating) >= value
                              ? "fill-neon-pink text-neon-pink"
                              : "text-muted-foreground"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="review-comment" className="text-xs font-medium text-muted-foreground">
                    Comment (optional)
                  </label>
                  <Textarea
                    id="review-comment"
                    rows={4}
                    maxLength={1000}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="How was your experience?"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-destructive">
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit review"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
