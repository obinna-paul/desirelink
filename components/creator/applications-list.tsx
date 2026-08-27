"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CreatorApplication } from "@/lib/creator";

const STATUS_VARIANT = {
  pending: "outline",
  approved: "neon",
  denied: "secondary",
} as const;

function ApplicationRow({
  application,
  onRespond,
  pending,
}: {
  application: CreatorApplication;
  onRespond?: (status: "approved" | "denied") => void;
  pending?: boolean;
}) {
  const initials = application.profile.displayName.slice(0, 2).toUpperCase();

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between md:rounded-lg md:shadow-none">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={application.profile.avatarUrl} alt={application.profile.displayName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{application.profile.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{application.profile.username} &middot; applied for {application.tier.name}
          </p>
        </div>
      </div>

      {onRespond ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full text-destructive sm:w-auto"
            disabled={pending}
            onClick={() => onRespond("denied")}
          >
            Deny
          </Button>
          <Button type="button" size="sm" className="w-full sm:w-auto" disabled={pending} onClick={() => onRespond("approved")}>
            Approve
          </Button>
        </div>
      ) : (
        <Badge variant={STATUS_VARIANT[application.status]} className="shrink-0 capitalize">
          {application.status}
        </Badge>
      )}
    </li>
  );
}

export function ApplicationsList({
  initialApplications,
}: {
  initialApplications: CreatorApplication[];
}) {
  const router = useRouter();
  const [applications, setApplications] = useState(initialApplications);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function respond(id: string, status: "approved" | "denied") {
    setRespondingId(id);
    const res = await fetch(`/api/creator/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setRespondingId(null);

    if (res.ok) {
      setApplications((prev) => prev.map((app) => (app.id === id ? { ...app, status } : app)));
      router.refresh();
    }
  }

  const pendingApplications = applications.filter((app) => app.status === "pending");
  const reviewedApplications = applications.filter((app) => app.status !== "pending");

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Pending ({pendingApplications.length})
        </h3>
        {pendingApplications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
            No pending applications right now.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingApplications.map((application) => (
              <ApplicationRow
                key={application.id}
                application={application}
                onRespond={(status) => respond(application.id, status)}
                pending={respondingId === application.id}
              />
            ))}
          </ul>
        )}
      </div>

      {reviewedApplications.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
            Reviewed
          </h3>
          <ul className="flex flex-col gap-3">
            {reviewedApplications.map((application) => (
              <ApplicationRow key={application.id} application={application} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
