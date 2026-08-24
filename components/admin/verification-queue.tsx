"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PendingVerificationRequest } from "@/lib/verification";

function RequestRow({
  request,
  onRespond,
  pending,
}: {
  request: PendingVerificationRequest;
  onRespond: (action: "approve" | "deny") => void;
  pending: boolean;
}) {
  const initials = request.profile.displayName.slice(0, 2).toUpperCase();

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={request.profile.avatarUrl} alt={request.profile.displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{request.profile.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{request.profile.username} &middot;{" "}
              {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 capitalize">
            {request.requestType}
          </Badge>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={pending}
            onClick={() => onRespond("deny")}
          >
            Deny
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={() => onRespond("approve")}>
            Approve
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <a href={request.govIdUrl} target="_blank" rel="noreferrer" className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Government ID</span>
          <span className="relative h-20 w-32 overflow-hidden rounded-lg border border-border/60 bg-secondary">
            <Image
              src={request.govIdUrl}
              alt={`${request.profile.displayName}'s government ID`}
              fill
              sizes="8rem"
              className="object-cover"
            />
          </span>
        </a>
        <a href={request.selfieUrl} target="_blank" rel="noreferrer" className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Selfie</span>
          <span className="relative h-20 w-32 overflow-hidden rounded-lg border border-border/60 bg-secondary">
            <Image
              src={request.selfieUrl}
              alt={`${request.profile.displayName}'s selfie`}
              fill
              sizes="8rem"
              className="object-cover"
            />
          </span>
        </a>
      </div>
    </li>
  );
}

export function VerificationQueue({ initialRequests }: { initialRequests: PendingVerificationRequest[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function respond(id: string, action: "approve" | "deny") {
    setRespondingId(id);
    const res = await fetch(`/api/admin/verification/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setRespondingId(null);

    if (res.ok) {
      setRequests((prev) => prev.filter((request) => request.id !== id));
      router.refresh();
    }
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No pending verification requests.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((request) => (
        <RequestRow
          key={request.id}
          request={request}
          pending={respondingId === request.id}
          onRespond={(action) => respond(request.id, action)}
        />
      ))}
    </ul>
  );
}
