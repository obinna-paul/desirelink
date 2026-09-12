"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Mail, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PublishToast } from "@/components/ui/publish-toast";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { VerificationRequestCard } from "@/components/verification/verification-request-card";

type InviteOptions = {
  liveStreamId: string | null;
};

type ChatTemplateId = "hi" | "compliment" | "flirty" | "direct" | "playful";

/** Icebreaker presets for messaging someone you haven't chatted with yet - a spread of
 * tones (safe default, a compliment, playful, direct, and flirtier) rather than a single
 * generic line, since "just say hi" isn't the only way people want to open a conversation
 * here. Each is a starting point the textarea below lets them edit before sending. */
const CHAT_TEMPLATES: { id: ChatTemplateId; label: string; message: string }[] = [
  { id: "hi", label: "Just say hi", message: "Hey! I'd love to chat with you sometime 🙂" },
  {
    id: "compliment",
    label: "Compliment",
    message: "Your profile really caught my eye — would love to get to know you 👀",
  },
  {
    id: "flirty",
    label: "Flirty",
    message: "Okay I have to say it — you're seriously stunning. Mind if we talk? 😏",
  },
  {
    id: "direct",
    label: "Straight to the point",
    message: "I'm interested in getting to know you. Are you open to chatting?",
  },
  {
    id: "playful",
    label: "Playful",
    message: "Not gonna lie, I scrolled past your profile more than once before working up the nerve to say hi 😅",
  },
];

type Selection = "live" | ChatTemplateId;

function defaultMessage(selection: Selection, liveStreamId: string | null, origin: string): string {
  if (selection === "live" && liveStreamId) {
    return `I'm live right now, come join! ${origin}/live/${liveStreamId}`;
  }
  return (CHAT_TEMPLATES.find((template) => template.id === selection) ?? CHAT_TEMPLATES[0]).message;
}

export function InviteButton({
  recipientId,
  recipientDisplayName,
  size = "default",
  className,
  viewerHasIdentityOnFile = false,
}: {
  recipientId: string;
  recipientDisplayName: string;
  size?: "default" | "sm";
  className?: string;
  /** Whether the viewer has ever submitted identity verification (pending counts). Shows
   * the verify-to-message gate immediately when the invite dialog opens, rather than
   * waiting for a send attempt to fail first. Defaults to false (gate shown) - fail
   * closed, so a call site that forgets to pass this never silently reopens messaging
   * for the unverified. */
  viewerHasIdentityOnFile?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<InviteOptions | null>(null);
  const [selection, setSelection] = useState<Selection>("hi");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIdentityGate, setShowIdentityGate] = useState(!viewerHasIdentityOnFile);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusTrap(open, dialogRef);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  function showConfirmation(message: string) {
    setConfirmation(message);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => setConfirmation(null), 5000);
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || options || loading || showIdentityGate) return;
    setLoading(true);
    fetch("/api/invite/options")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: InviteOptions | null) => {
        if (!data) return;
        setOptions(data);
        setSelection(data.liveStreamId ? "live" : "hi");
      })
      .finally(() => setLoading(false));
  }, [open, options, loading, showIdentityGate]);

  useEffect(() => {
    if (!options) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setMessage(defaultMessage(selection, options.liveStreamId, origin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, options]);

  async function sendInvite() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);

    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId, content: message }),
    });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (body?.code === "IDENTITY_VERIFICATION_REQUIRED") {
        setShowIdentityGate(true);
        return;
      }
      setError(body?.error ?? "Couldn't send that invite.");
      return;
    }

    setOpen(false);
    setSent(true);
    router.refresh();
  }

  if (sent) {
    return (
      <Button type="button" variant="outline" size={size} className={cn("gap-1.5", className)} disabled>
        <Check className="h-4 w-4" aria-hidden="true" /> Invite sent
      </Button>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      {confirmation && <PublishToast message={confirmation} />}
      <Button
        type="button"
        variant="outline"
        size={size}
        className="gap-1.5"
        aria-pressed={open}
        onClick={() => setOpen(true)}
      >
        <Mail className="h-4 w-4" aria-hidden="true" /> Invite
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-dialog-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className={cn(
              "flex max-h-[85vh] w-full flex-col rounded-2xl border border-border/60 bg-card p-5 shadow-xl focus:outline-none",
              showIdentityGate ? "max-w-md" : "max-w-sm"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="invite-dialog-title" className="text-sm font-semibold">
                {showIdentityGate ? "Verify your identity" : `Invite ${recipientDisplayName}`}
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

            {loading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : showIdentityGate ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <VerificationRequestCard
                  requestType="member"
                  isVerified={false}
                  latestStatus={null}
                  heading="Verify your identity to send messages."
                  skipRefresh
                  onSubmitted={() => {
                    setShowIdentityGate(false);
                    showConfirmation("You're verified — go ahead and send your invite.");
                    void sendInvite();
                  }}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                  <div className="flex flex-col gap-1">
                    {options?.liveStreamId && (
                      <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
                        <input
                          type="radio"
                          name="invite-kind"
                          checked={selection === "live"}
                          onChange={() => setSelection("live")}
                        />
                        My live stream
                      </label>
                    )}
                    {CHAT_TEMPLATES.map((template) => (
                      <label
                        key={template.id}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
                      >
                        <input
                          type="radio"
                          name="invite-kind"
                          checked={selection === template.id}
                          onChange={() => setSelection(template.id)}
                        />
                        {template.label}
                      </label>
                    ))}
                  </div>

                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus-visible:border-primary/60"
                  />

                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>

                <Button type="button" size="sm" disabled={sending || !message.trim()} onClick={sendInvite}>
                  {sending ? "Sending..." : "Send invite"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
