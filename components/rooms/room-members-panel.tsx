"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, UserMinus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoomMemberData } from "@/lib/rooms";

function MemberRow({
  member,
  action,
}: {
  member: RoomMemberData;
  action?: React.ReactNode;
}) {
  const initials = member.profile.displayName.slice(0, 2).toUpperCase();

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-3">
      <Link href={`/profile/${member.profile.username}`} className="flex min-w-0 items-center gap-2">
        <Avatar className="h-9 w-9 border border-border">
          <AvatarImage src={member.profile.avatarUrl} alt={member.profile.displayName} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="truncate text-sm font-medium">{member.profile.displayName}</p>
            {member.role === "admin" && (
              <Badge variant="neon" className="shrink-0 gap-1 px-1.5 py-0 text-[10px]">
                <Sparkles className="h-2.5 w-2.5" aria-hidden="true" /> Admin
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">@{member.profile.username}</p>
        </div>
      </Link>
      {action}
    </li>
  );
}

export function RoomMembersPanel({
  roomId,
  initialMembers,
  initialPending,
  isAdmin,
}: {
  roomId: string;
  initialMembers: RoomMemberData[];
  initialPending: RoomMemberData[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [pending, setPending] = useState(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleApprove(member: RoomMemberData) {
    setBusyId(member.id);
    const res = await fetch(`/api/rooms/${roomId}/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    setBusyId(null);

    if (res.ok) {
      setPending((prev) => prev.filter((m) => m.id !== member.id));
      setMembers((prev) => [...prev, { ...member, status: "approved" }]);
      router.refresh();
    }
  }

  async function handleRemove(member: RoomMemberData, fromPending: boolean) {
    setBusyId(member.id);
    const res = await fetch(`/api/rooms/${roomId}/members/${member.id}`, { method: "DELETE" });
    setBusyId(null);

    if (res.ok) {
      if (fromPending) {
        setPending((prev) => prev.filter((m) => m.id !== member.id));
      } else {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
      }
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && pending.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending requests ({pending.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {pending.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                action={
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={busyId === member.id}
                      onClick={() => handleRemove(member, true)}
                    >
                      Deny
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === member.id}
                      onClick={() => handleApprove(member)}
                    >
                      Approve
                    </Button>
                  </div>
                }
              />
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Members ({members.length})
        </h3>
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              action={
                isAdmin && member.role !== "admin" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${member.profile.displayName}`}
                    disabled={busyId === member.id}
                    onClick={() => handleRemove(member, false)}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <UserMinus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : undefined
              }
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
