"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Fingerprint, X } from "lucide-react";

import { archetypeDisplayName, archetypeSummary, likeSummaryPrompt } from "@/lib/spec-test/archetype-labels";
import type { Gender } from "@/lib/spec-test/gender/forms";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

/**
 * The "My spec is X" badge, tappable to open a short snapshot of what that archetype means -
 * so a viewer can judge fit without taking the test themselves. Two visual variants match the
 * two places this badge already renders: "card" (the dark overlay pill on the home feed's
 * ProfileCard) and "profile" (the bordered pill on the full profile page).
 *
 * The popup itself is rendered via a portal into document.body rather than inline: this badge
 * is used inside components/home/profile-card.tsx, where the whole card is one <Link> - a
 * portal keeps the dialog's markup out of that anchor's DOM subtree entirely, sidestepping
 * both an invalid nested-interactive-content structure and a `fixed` element being scoped to a
 * transformed ancestor (that Link has a hover translate) instead of the viewport. React's
 * synthetic events still bubble along the component tree through a portal, so stopPropagation
 * on the trigger button below still reliably cancels that Link's own click handling.
 */
export function SpecBadge({
  specType,
  assumedAttractionTarget,
  variant,
  className,
}: {
  specType: string | null | undefined;
  /** Profile.specTestResults[0].assumedAttractionTarget - which gender the archetype summary
   *  below is phrased as "I like a woman/man who is..." for. Missing (a pre-gender-question
   *  row) falls back the same way likeSummaryPrompt's own default does. */
  assumedAttractionTarget?: string | null;
  variant: "card" | "profile";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useFocusTrap(open, dialogRef);

  const name = archetypeDisplayName(specType);
  const summary = archetypeSummary(specType);
  const prompt = summary ? likeSummaryPrompt(summary, assumedAttractionTarget as Gender | null) : null;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!name || !summary) return null;

  function openDialog(event: React.MouseEvent | React.KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="theme-clay fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            onClick={(event) => {
              event.stopPropagation();
              closeDialog();
            }}
          >
            <div
              ref={dialogRef}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-xs rounded-3xl border border-border bg-card text-foreground shadow-lift motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200 focus:outline-none"
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeDialog();
                }}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="flex flex-col gap-3 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-tint">
                  <Fingerprint className="h-5 w-5 text-primary" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">The Spec Test</p>
                  <h2 id={titleId} className="mt-1 font-heading text-xl font-semibold text-foreground">
                    {name}
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{prompt}</p>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        aria-label={`My spec is ${name}. Tap to see what this spec means.`}
        className={cn(
          variant === "card"
            ? "mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-transparent p-0 text-[10px] font-medium text-white/90 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:text-xs"
            : "inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-accent-tint px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-accent-tint/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
      >
        <Fingerprint
          className={cn("shrink-0", variant === "card" ? "h-3 w-3" : "h-3 w-3 text-primary")}
          aria-hidden="true"
        />
        <span className="truncate">My spec is {name}</span>
      </button>
      {dialog}
    </>
  );
}
