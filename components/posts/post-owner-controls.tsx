"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Crown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

type PendingAction = "archive" | "delete" | "edit" | null;

export function PostOwnerControls({
  postId,
  canEdit,
  initialContent,
  initialSubscriberOnly,
  isPinned,
}: {
  postId: string;
  canEdit: boolean;
  initialContent: string;
  initialSubscriberOnly: boolean;
  isPinned: boolean;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [isSubscriberOnly, setIsSubscriberOnly] = useState(
    initialSubscriberOnly,
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinPending, setPinPending] = useState(false);

  const dialogOpen = editOpen || showUpsell;
  useFocusTrap(dialogOpen, dialogRef);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!dialogOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeDialog();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [dialogOpen]);

  function resetConfirmations() {
    setConfirmArchive(false);
    setConfirmDelete(false);
  }

  function closeDialog() {
    setEditOpen(false);
    setShowUpsell(false);
    setPendingAction(null);
    setError(null);
  }

  function openEdit() {
    setMenuOpen(false);
    resetConfirmations();
    setError(null);
    if (!canEdit) {
      setShowUpsell(true);
      return;
    }
    setContent(initialContent);
    setIsSubscriberOnly(initialSubscriberOnly);
    setEditOpen(true);
  }

  async function archivePost() {
    if (!confirmArchive) {
      setConfirmArchive(true);
      setConfirmDelete(false);
      return;
    }

    setPendingAction("archive");
    setError(null);
    const res = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    const body = await res.json().catch(() => null);
    setPendingAction(null);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't archive post.");
      return;
    }

    setMenuOpen(false);
    router.refresh();
  }

  async function deletePost() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setConfirmArchive(false);
      return;
    }

    setPendingAction("delete");
    setError(null);
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setPendingAction(null);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't delete post.");
      return;
    }

    setMenuOpen(false);
    router.refresh();
  }

  async function togglePin() {
    setPinPending(true);
    setError(null);
    const res = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isPinned ? "unpin" : "pin" }),
    });
    const body = await res.json().catch(() => null);
    setPinPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't update pin.");
      return;
    }

    setMenuOpen(false);
    router.refresh();
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) {
      setError("Post can't be empty.");
      return;
    }

    setPendingAction("edit");
    setError(null);
    const res = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit",
        content: content.trim(),
        isSubscriberOnly,
      }),
    });
    const body = await res.json().catch(() => null);
    setPendingAction(null);

    if (!res.ok) {
      if (body?.code === "PREMIUM_REQUIRED") {
        setEditOpen(false);
        setShowUpsell(true);
      }
      setError(body?.error ?? "Couldn't save changes.");
      return;
    }

    closeDialog();
    router.refresh();
  }

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-label="Post options"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((open) => !open);
            resetConfirmations();
            setError(null);
          }}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-11 z-30 w-64 overflow-hidden rounded-2xl border border-border/70 bg-card p-1.5 shadow-xl">
            <button
              type="button"
              onClick={openEdit}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
            >
              {canEdit ? (
                <Pencil
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <Crown className="h-4 w-4 text-neon-pink" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                {canEdit ? "Edit post" : "Edit with Premium"}
              </span>
            </button>
            <button
              type="button"
              onClick={togglePin}
              disabled={pinPending}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
            >
              {pinPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : isPinned ? (
                <PinOff
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <Pin
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <span>{isPinned ? "Unpin from profile" : "Pin to profile"}</span>
            </button>
            <button
              type="button"
              onClick={archivePost}
              disabled={pendingAction !== null}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60",
                confirmArchive &&
                  "bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}
            >
              {pendingAction === "archive" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Archive
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <span>
                {confirmArchive ? "Click again to archive" : "Archive post"}
              </span>
            </button>
            <button
              type="button"
              onClick={deletePost}
              disabled={pendingAction !== null}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60",
                confirmDelete && "bg-destructive/10",
              )}
            >
              {pendingAction === "delete" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {confirmDelete ? "Click again to delete" : "Delete post"}
              </span>
            </button>
            {error && (
              <p className="px-3 py-2 text-xs leading-5 text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {dialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-edit-dialog-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={closeDialog}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-4 shadow-xl focus:outline-none sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                id="post-edit-dialog-title"
                className="font-heading text-lg font-semibold tracking-tight"
              >
                {showUpsell ? "Premium editing" : "Edit post"}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeDialog}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {showUpsell ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-neon-pink/20 bg-neon-pink/10 p-4">
                  <Crown
                    className="h-6 w-6 text-neon-pink"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-sm font-semibold">
                    Editing after publishing is premium-only.
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    You can still archive or delete your own posts for free.
                    Upgrade when you want to revise published content.
                  </p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button asChild className="w-full">
                  <Link href="/settings/billing">Upgrade to Premium</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={saveEdit} className="flex flex-col gap-4">
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={2000}
                  rows={6}
                  className="min-h-40 resize-none rounded-2xl text-base sm:text-sm"
                />
                <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/50 px-3 py-2">
                  <span>
                    <span className="block text-sm font-semibold">
                      Fans only
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Limit this post to subscribers.
                    </span>
                  </span>
                  <Switch
                    checked={isSubscriberOnly}
                    onCheckedChange={setIsSubscriberOnly}
                  />
                </label>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  type="submit"
                  disabled={pendingAction === "edit" || !content.trim()}
                  className="w-full"
                >
                  {pendingAction === "edit" && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  Save changes
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
