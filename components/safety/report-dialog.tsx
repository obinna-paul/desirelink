"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASONS } from "@/lib/report";
import type { ReportTargetType } from "@/lib/report";
import { useFocusTrap } from "@/lib/use-focus-trap";

export function ReportDialog({
  targetType,
  targetId,
  label = "Report",
  variant = "button",
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
  variant?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function openDialog() {
    setReason(REPORT_REASONS[0]);
    setDetails("");
    setError(null);
    setSubmitted(false);
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason, details }),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't submit your report. Try again.");
      return;
    }

    setSubmitted(true);
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          aria-label={label}
          onClick={openDialog}
          className="text-muted-foreground transition-colors hover:text-destructive"
        >
          <Flag className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openDialog}>
          <Flag className="h-3.5 w-3.5" aria-hidden="true" /> {label}
        </Button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="w-full max-w-sm rounded-xl border border-border/60 bg-card p-5 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="report-dialog-title" className="text-sm font-semibold">
                Report {targetType}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-sm font-medium">Report submitted</p>
                <p className="text-xs text-muted-foreground">
                  Thanks for letting us know. Our team will review it.
                </p>
                <Button type="button" size="sm" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="report-reason" className="text-xs font-medium text-muted-foreground">
                    Reason
                  </label>
                  <Select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                    {REPORT_REASONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="report-details" className="text-xs font-medium text-muted-foreground">
                    Details (optional)
                  </label>
                  <Textarea
                    id="report-details"
                    rows={4}
                    maxLength={2000}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Anything that will help us review this..."
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
                    {submitting ? "Submitting..." : "Submit report"}
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
