"use client";

import { useState } from "react";
import { Check, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * Optional, on the result page - never gates the reading itself. Sends a copy of the
 * already-visible result to an email address the taker provides. consentMarketing
 * defaults off: per docs/spec-test-quiz.md, taking the quiz must never quietly opt
 * someone into marketing.
 */
export function EmailCaptureForm({ resultId }: { resultId: string }) {
  const [email, setEmail] = useState("");
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch(`/api/spec-test/result/${resultId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consentMarketing }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Something went wrong sending your result. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Something went wrong sending your result. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="h-4 w-4 text-primary" aria-hidden="true" />
        Sent! Check your inbox for a copy of your result.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={status === "sending"} className="gap-1.5">
          {status === "sending" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Mail className="h-4 w-4" aria-hidden="true" />
          )}
          Email me this
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <label className="flex items-center gap-2.5 text-xs text-muted-foreground">
        <Switch checked={consentMarketing} onCheckedChange={setConsentMarketing} />
        Keep me updated about Udala
      </label>
    </form>
  );
}
