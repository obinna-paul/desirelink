"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteAccountSection({ username, hasPassword }: { username: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = confirmUsername.trim().toLowerCase() === username.toLowerCase() && (!hasPassword || password.length > 0);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("submitting");

    const res = await fetch("/api/settings/security/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUsername, password: hasPassword ? password : undefined }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus("idle");
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    void signOut({ callbackUrl: "/login" });
  }

  return (
    <section className="rounded-2xl border border-destructive/40 bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">Delete account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This permanently deletes your profile, posts, messages, and everything else tied to your account. This
            can&apos;t be undone.
          </p>
        </div>
      </div>

      {!open ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="mt-5 border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Delete my account
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmUsername" className="text-sm font-medium text-foreground">
              Type <span className="font-semibold">{username}</span> to confirm
            </label>
            <Input
              id="confirmUsername"
              value={confirmUsername}
              onChange={(event) => setConfirmUsername(event.target.value)}
              autoComplete="off"
              required
            />
          </div>

          {hasPassword && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="deletePassword" className="text-sm font-medium text-foreground">
                Enter your password
              </label>
              <Input
                id="deletePassword"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-[#b42318]">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setConfirmUsername("");
                setPassword("");
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!canSubmit || status === "submitting"}>
              {status === "submitting" ? "Deleting..." : "Permanently delete my account"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
