"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Link2, Link2Off } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PartnerState } from "@/lib/partners";

function ProfileRow({
  profile,
  children,
}: {
  profile: { username: string; displayName: string; avatarUrl: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
      <Link href={`/profile/${profile.username}`} className="flex min-w-0 items-center gap-2">
        <Avatar className="h-8 w-8 border border-border">
          <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
          <AvatarFallback>{profile.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{profile.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.username}</p>
        </div>
      </Link>
      {children}
    </div>
  );
}

export function PartnerLinkPanel({ initialState }: { initialState: PartnerState }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(request: () => Promise<Response>) {
    setPending(true);
    setError(null);
    const res = await request();
    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setUsername("");
    router.refresh();
  }

  function sendInvite() {
    if (!username.trim()) return;
    runAction(() =>
      fetch("/api/partners/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      })
    );
  }

  function respond(inviteId: string, action: "accept" | "decline" | "cancel") {
    runAction(() =>
      fetch(`/api/partners/invites/${inviteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
    );
  }

  function unlink() {
    if (!window.confirm("Unlink your partner? You can both send new invites afterward.")) return;
    runAction(() => fetch("/api/partners/unlink", { method: "POST" }));
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Partner</h2>

      {initialState.partner ? (
        <ProfileRow profile={initialState.partner}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            disabled={pending}
            onClick={unlink}
          >
            <Link2Off className="h-3.5 w-3.5" aria-hidden="true" />
            Unlink
          </Button>
        </ProfileRow>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Link your accounts to show up as a linked pair.
          </p>
          <div className="flex gap-2">
            <Input
              aria-label="Partner's username"
              placeholder="Partner's username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  sendInvite();
                }
              }}
            />
            <Button type="button" className="gap-1.5" disabled={pending || !username.trim()} onClick={sendInvite}>
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              Invite
            </Button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {initialState.incoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Invites for you</p>
          {initialState.incoming.map((invite) => (
            <ProfileRow key={invite.id} profile={invite.profile}>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={() => respond(invite.id, "accept")}>
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => respond(invite.id, "decline")}
                >
                  Decline
                </Button>
              </div>
            </ProfileRow>
          ))}
        </div>
      )}

      {initialState.outgoing.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Sent invites</p>
          {initialState.outgoing.map((invite) => (
            <ProfileRow key={invite.id} profile={invite.profile}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => respond(invite.id, "cancel")}
              >
                Cancel
              </Button>
            </ProfileRow>
          ))}
        </div>
      )}
    </section>
  );
}
