"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LifeBuoy, Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

const CLOSE_ANIMATION_MS = 240;
const DRAG_DISMISS_THRESHOLD = 110;

/** Slide-up bottom sheet for the "Help & Support" profile menu item, styled after CommentsSheet. */
export function HelpSupportSheet({ defaultEmail }: { defaultEmail: string }) {
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragState = useRef<{ startY: number; dragging: boolean } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useFocusTrap(open, sheetRef);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    if (rendered) {
      setVisible(false);
      const timeout = setTimeout(() => setRendered(false), CLOSE_ANIMATION_MS);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!rendered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rendered]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function openSheet() {
    setEmail(defaultEmail);
    setSubject("");
    setMessage("");
    setError(null);
    setStatus("idle");
    setOpen(true);
  }

  function closeSheet() {
    setOpen(false);
  }

  function handleDragStart(event: React.PointerEvent) {
    dragState.current = { startY: event.clientY, dragging: true };
  }

  function handleDragMove(event: React.PointerEvent) {
    if (!dragState.current?.dragging) return;
    const delta = event.clientY - dragState.current.startY;
    setDragOffset(Math.max(0, delta));
  }

  function handleDragEnd() {
    if (!dragState.current) return;
    dragState.current.dragging = false;
    if (dragOffset > DRAG_DISMISS_THRESHOLD) closeSheet();
    setDragOffset(0);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("submitting");

    const res = await fetch("/api/support/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), subject, message }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setStatus("idle");
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStatus("sent");
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="flex min-h-11 w-full items-center gap-1.5 rounded-lg px-3 text-sm font-medium hover:bg-accent"
      >
        <LifeBuoy className="h-4 w-4" aria-hidden="true" /> Help & Support
      </button>

      {rendered && (
        <div className="fixed inset-0 z-50" aria-hidden={!open}>
          <div
            className={cn(
              "absolute inset-0 bg-foreground/45 backdrop-blur-[1px] transition-opacity motion-reduce:transition-none",
              visible ? "opacity-100 duration-300" : "opacity-0 duration-200"
            )}
            onClick={closeSheet}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-support-title"
            className={cn(
              "absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col overflow-hidden rounded-t-[22px] bg-card shadow-lift transition-transform motion-reduce:transition-none sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-full sm:max-w-md sm:rounded-[22px]",
              visible ? "translate-y-0 duration-300 ease-out" : "translate-y-full duration-200 ease-in"
            )}
            style={dragState.current?.dragging ? { transform: `translateY(${dragOffset}px)`, transition: "none" } : undefined}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-1 pt-2.5 active:cursor-grabbing sm:hidden"
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <span className="h-1 w-9 rounded-full bg-border" aria-hidden="true" />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 pt-3 sm:pt-6">
              {status === "sent" ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <p className="font-heading text-lg font-semibold text-foreground">Message sent</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Thanks for reaching out — a real person will reply to {email || "your email"} within 24 hours,
                    usually much sooner.
                  </p>
                  <Button type="button" className="mt-2 min-w-32" onClick={closeSheet}>
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-5 flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-primary">
                      <LifeBuoy className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 id="help-support-title" className="font-heading text-lg font-semibold text-foreground">
                        Contact support
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Tell us what&apos;s going on — we reply within 24 hours, usually much sooner.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="help-email" className="text-xs font-medium text-muted-foreground">
                        Email
                      </label>
                      <div className="relative">
                        <Mail
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          id="help-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-muted pl-9"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="help-subject" className="text-xs font-medium text-muted-foreground">
                        Subject
                      </label>
                      <Input
                        id="help-subject"
                        required
                        placeholder="What's this about?"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="help-message" className="text-xs font-medium text-muted-foreground">
                        Message
                      </label>
                      <Textarea
                        id="help-message"
                        required
                        rows={5}
                        placeholder="Tell us what's going on..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </div>

                    {error && (
                      <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                        {error}
                      </p>
                    )}

                    <Button type="submit" disabled={status === "submitting"} className="mt-1 gap-1.5">
                      {status === "submitting" ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="h-4 w-4" aria-hidden="true" /> Send message
                        </>
                      )}
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
