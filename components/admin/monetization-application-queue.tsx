"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PendingMonetizationApplication } from "@/lib/monetization";

function ApplicationRow({
  application,
  onRespond,
  pending,
}: {
  application: PendingMonetizationApplication;
  onRespond: (action: "approve" | "deny") => void;
  pending: boolean;
}) {
  const initials = application.provider.displayName.slice(0, 2).toUpperCase();

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between md:rounded-lg md:shadow-none">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={application.provider.avatarUrl} alt={application.provider.displayName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{application.provider.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{application.provider.username} &middot;{" "}
            {formatDistanceToNow(new Date(application.createdAt), { addSuffix: true })}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 capitalize">
          {application.provider.profileType.toLowerCase().replace("_", " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full text-destructive sm:w-auto"
          disabled={pending}
          onClick={() => onRespond("deny")}
        >
          Deny
        </Button>
        <Button type="button" size="sm" className="w-full sm:w-auto" disabled={pending} onClick={() => onRespond("approve")}>
          Approve
        </Button>
      </div>
    </li>
  );
}

export function MonetizationApplicationQueue({
  initialApplications,
}: {
  initialApplications: PendingMonetizationApplication[];
}) {
  const router = useRouter();
  const [applications, setApplications] = useState(initialApplications);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function respond(id: string, action: "approve" | "deny") {
    setRespondingId(id);
    const res = await fetch(`/api/admin/monetization-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setRespondingId(null);

    if (res.ok) {
      setApplications((prev) => prev.filter((application) => application.id !== id));
      router.refresh();
    }
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
        No pending monetization applications.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {applications.map((application) => (
        <ApplicationRow
          key={application.id}
          application={application}
          pending={respondingId === application.id}
          onRespond={(action) => respond(application.id, action)}
        />
      ))}
    </ul>
  );
}
