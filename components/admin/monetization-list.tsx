"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MonetizedProviderSummary } from "@/lib/monetization";

function ProviderRow({
  provider,
  onToggle,
  pending,
}: {
  provider: MonetizedProviderSummary;
  onToggle: (action: "suspend" | "reinstate") => void;
  pending: boolean;
}) {
  const initials = provider.displayName.slice(0, 2).toUpperCase();
  const isSuspended = provider.monetizationStatus === "suspended";

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between md:rounded-lg md:shadow-none">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={provider.avatarUrl} alt={provider.displayName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{provider.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{provider.username} &middot; {provider.profileType}
          </p>
        </div>
        <Badge variant={isSuspended ? "outline" : "neon"} className={isSuspended ? "text-destructive" : ""}>
          {isSuspended ? "Suspended" : "Monetized"}
        </Badge>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className={isSuspended ? "w-full sm:w-auto" : "w-full text-destructive sm:w-auto"}
        disabled={pending}
        onClick={() => onToggle(isSuspended ? "reinstate" : "suspend")}
      >
        {isSuspended ? "Reinstate" : "Suspend"}
      </Button>
    </li>
  );
}

export function MonetizationList({ initialProviders }: { initialProviders: MonetizedProviderSummary[] }) {
  const router = useRouter();
  const [providers, setProviders] = useState(initialProviders);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggle(id: string, action: "suspend" | "reinstate") {
    setPendingId(id);
    const res = await fetch(`/api/admin/monetization/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPendingId(null);

    if (res.ok) {
      setProviders((prev) =>
        action === "reinstate"
          ? prev.filter((provider) => provider.id !== id)
          : prev.map((provider) =>
              provider.id === id ? { ...provider, monetizationStatus: "suspended" } : provider
            )
      );
      router.refresh();
    }
  }

  if (providers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
        No monetized or suspended providers yet.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {providers.map((provider) => (
        <ProviderRow
          key={provider.id}
          provider={provider}
          pending={pendingId === provider.id}
          onToggle={(action) => toggle(provider.id, action)}
        />
      ))}
    </ul>
  );
}
