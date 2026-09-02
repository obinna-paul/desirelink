"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InviteOptions = {
  liveStreamId: string | null;
};

type InviteKind = { type: "live"; streamId: string } | { type: "chat" };

function defaultMessage(kind: InviteKind, origin: string): string {
  if (kind.type === "live") {
    return `I'm live right now, come join! ${origin}/live/${kind.streamId}`;
  }
  return "Hey! I'd love to chat with you sometime 🙂";
}

export function InviteButton({
  recipientId,
  recipientDisplayName,
  size = "default",
  className,
}: {
  recipientId: string;
  recipientDisplayName: string;
  size?: "default" | "sm";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<InviteOptions | null>(null);
  const [selection, setSelection] = useState<"live" | "chat" | string>("chat");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || options || loading) return;
    setLoading(true);
    fetch("/api/invite/options")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: InviteOptions | null) => {
        if (!data) return;
        setOptions(data);
        setSelection(data.liveStreamId ? "live" : "chat");
      })
      .finally(() => setLoading(false));
  }, [open, options, loading]);

  useEffect(() => {
    if (!options) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const kind: InviteKind =
      selection === "live" && options.liveStreamId
        ? { type: "live", streamId: options.liveStreamId }
        : { type: "chat" };
    setMessage(defaultMessage(kind, origin));
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
      setError(body?.error ?? "Couldn't send that invite.");
      return;
    }

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
    <div className="min-w-0">
      <Button
        type="button"
        variant="outline"
        size={size}
        className={cn("gap-1.5", className)}
        aria-pressed={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Mail className="h-4 w-4" aria-hidden="true" /> Invite
      </Button>

      {open && (
        <div className="mt-2 flex w-72 flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-lift">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Invite {recipientDisplayName} to</p>
                <div className="flex flex-col gap-1">
                  {options?.liveStreamId && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="invite-kind"
                        checked={selection === "live"}
                        onChange={() => setSelection("live")}
                      />
                      My live stream
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="invite-kind"
                      checked={selection === "chat"}
                      onChange={() => setSelection("chat")}
                    />
                    Just say hi
                  </label>
                </div>
              </div>

              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus-visible:border-primary/60"
              />

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button type="button" size="sm" disabled={sending || !message.trim()} onClick={sendInvite}>
                {sending ? "Sending..." : "Send invite"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
