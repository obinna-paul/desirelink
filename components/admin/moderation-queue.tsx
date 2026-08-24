"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Ban, Check, Eye, Trash2, TriangleAlert } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ModerationAction, ModerationQueueItem } from "@/lib/moderation";

const ACTION_LABELS: Record<ModerationAction, string> = {
  review: "Mark reviewed",
  remove: "Remove content",
  warn: "Warn user",
  suspend: "Suspend user",
};

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function contentTypeLabel(contentType: string) {
  return contentType.replace("_", " ");
}

function ModerationRow({
  item,
  pendingAction,
  onAction,
}: {
  item: ModerationQueueItem;
  pendingAction: ModerationAction | null;
  onAction: (action: ModerationAction) => void;
}) {
  const owner = item.owner;
  const preview = item.contentPreview;

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
            <TriangleAlert className="h-5 w-5 text-destructive" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{preview?.title ?? "Content unavailable"}</h2>
              <Badge variant="outline" className="capitalize">
                {contentTypeLabel(item.contentType)}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.reason} &middot; {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        {owner && (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2">
            <Avatar className="h-7 w-7 border border-border">
              <AvatarImage src={owner.avatarUrl} alt={owner.displayName} />
              <AvatarFallback className="text-[10px]">{initials(owner.displayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{owner.displayName}</p>
              <p className="text-[10px] text-muted-foreground">
                {owner.warningCount} warnings{owner.isSuspended ? " - suspended" : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-background/40 p-3">
        <p className="max-h-24 overflow-hidden whitespace-pre-wrap text-sm">
          {preview?.body || item.details || "No preview available."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{item.details}</p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={Boolean(pendingAction)}
          onClick={() => onAction("review")}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {pendingAction === "review" ? "Saving..." : ACTION_LABELS.review}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={Boolean(pendingAction) || !owner}
          onClick={() => onAction("warn")}
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {pendingAction === "warn" ? "Saving..." : ACTION_LABELS.warn}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive hover:text-destructive"
          disabled={Boolean(pendingAction)}
          onClick={() => onAction("remove")}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {pendingAction === "remove" ? "Saving..." : ACTION_LABELS.remove}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive hover:text-destructive"
          disabled={Boolean(pendingAction) || !owner}
          onClick={() => onAction("suspend")}
        >
          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
          {pendingAction === "suspend" ? "Saving..." : ACTION_LABELS.suspend}
        </Button>
      </div>
    </li>
  );
}

export function ModerationQueue({ initialItems }: { initialItems: ModerationQueueItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState<{ id: string; action: ModerationAction } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function takeAction(id: string, action: ModerationAction) {
    setBusy({ id, action });
    setError(null);

    const res = await fetch(`/api/admin/moderation/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await res.json().catch(() => null);
    setBusy(null);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't update moderation item.");
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No pending moderation flags.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <ModerationRow
            key={item.id}
            item={item}
            pendingAction={busy?.id === item.id ? busy.action : null}
            onAction={(action) => takeAction(item.id, action)}
          />
        ))}
      </ul>
    </div>
  );
}
