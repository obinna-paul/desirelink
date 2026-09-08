"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, CheckCircle2, Clock3, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getNextUsernameChangeAt } from "@/lib/username-change";
import { isValidUsernameFormat, normalizeUsername } from "@/lib/username-format";
import { cn } from "@/lib/utils";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

function formatChangeDate(value: Date) {
  return value.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function UsernameEditor({
  initialUsername,
  lastChangedAt,
}: {
  initialUsername: string;
  lastChangedAt: string | null;
}) {
  const router = useRouter();
  const [currentUsername, setCurrentUsername] = useState(initialUsername);
  const [value, setValue] = useState(initialUsername);
  const [nextChangeAt, setNextChangeAt] = useState(() => getNextUsernameChangeAt(lastChangedAt));
  const [availability, setAvailability] = useState<Availability>("idle");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizeUsername(value);
  const isUnchanged = normalized === currentUsername;
  const changeAllowed = !nextChangeAt || nextChangeAt.getTime() <= Date.now();

  useEffect(() => {
    setError(null);
    if (isUnchanged) {
      setAvailability("idle");
      return;
    }
    if (!isValidUsernameFormat(normalized)) {
      setAvailability("invalid");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAvailability("checking");
      try {
        const response = await fetch(`/api/profile/username?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as {
          available?: boolean;
          error?: string;
        } | null;
        if (!response.ok) throw new Error(body?.error ?? "Availability check failed");
        if (!controller.signal.aborted) setAvailability(body?.available ? "available" : "taken");
      } catch (requestError) {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setAvailability("idle");
          setError("Couldn't check that username right now. Please try again.");
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isUnchanged, normalized]);

  async function saveUsername() {
    if (!changeAllowed || isUnchanged || availability !== "available" || status === "saving") return;
    setStatus("saving");
    setError(null);

    const response = await fetch("/api/profile/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: normalized }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      username?: string;
      nextChangeAt?: string | null;
    } | null;

    if (!response.ok) {
      setStatus("idle");
      setError(body?.error ?? "Couldn't change your username. Please try again.");
      if (body?.nextChangeAt) setNextChangeAt(new Date(body.nextChangeAt));
      return;
    }

    const savedUsername = body?.username ?? normalized;
    setCurrentUsername(savedUsername);
    setValue(savedUsername);
    setNextChangeAt(body?.nextChangeAt ? new Date(body.nextChangeAt) : getNextUsernameChangeAt(new Date()));
    setAvailability("idle");
    setStatus("saved");
    router.refresh();
  }

  const availabilityMessage =
    availability === "checking"
      ? "Checking availability..."
      : availability === "available"
        ? `@${normalized} is available`
        : availability === "taken"
          ? `@${normalized} is already taken`
          : availability === "invalid"
            ? "Use 3-20 lowercase letters, numbers, periods, or underscores. Periods cannot be first or last."
            : null;

  return (
    <div className="border-b border-border/70 pb-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <AtSign className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor="username" className="text-sm font-semibold text-foreground">
            Username
          </label>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            You can only change this once in a month.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
            <input
              id="username"
              value={value}
              disabled={!changeAllowed || status === "saving"}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              spellCheck={false}
              maxLength={20}
              onChange={(event) => {
                setValue(event.target.value.toLowerCase().replace(/\s/g, ""));
                setStatus("idle");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveUsername();
                }
              }}
              aria-describedby="username-status username-cooldown"
              className={cn(
                "h-11 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none transition-colors focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
                availability === "taken" || availability === "invalid" ? "border-destructive" : "",
              )}
            />
          </div>
          <div id="username-status" aria-live="polite" className="mt-1.5 min-h-5 text-xs">
            {availabilityMessage && (
              <span className={availability === "available" ? "text-trust" : availability === "checking" ? "text-muted-foreground" : "text-destructive"}>
                {availabilityMessage}
              </span>
            )}
            {status === "saved" && (
              <span className="inline-flex items-center gap-1 text-trust">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Username changed
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void saveUsername()}
          disabled={!changeAllowed || isUnchanged || availability !== "available" || status === "saving"}
          className="h-11 w-full shrink-0 sm:w-auto"
        >
          {status === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {status === "saving" ? "Changing..." : "Change username"}
        </Button>
      </div>

      <div id="username-cooldown" className="mt-2 text-xs leading-5 text-muted-foreground">
        {nextChangeAt && nextChangeAt.getTime() > Date.now() ? (
          <span className="inline-flex items-start gap-1.5">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            You can change it again on {formatChangeDate(nextChangeAt)}.
          </span>
        ) : (
          <span>Your profile link and @mentions will update with your new username.</span>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
