"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import useSWR from "swr";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
  actor: { username: string; displayName: string; avatarUrl: string } | null;
};

type NotificationResponse = { items: NotificationItem[]; unreadCount: number };

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load notifications");
  return response.json() as Promise<NotificationResponse>;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, mutate, isLoading } = useSWR<NotificationResponse>("/api/notifications", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
  const unreadCount = data?.unreadCount ?? 0;

  async function markRead(id?: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    await mutate();
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[min(70vh,34rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-lift md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-[23rem]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="text-xs text-muted-foreground">{unreadCount ? `${unreadCount} unread` : "You're caught up"}</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markRead()}
                className="inline-flex min-h-10 items-center gap-1.5 px-2 text-xs font-semibold text-primary hover:underline"
              >
                <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[calc(min(70vh,34rem)-4.25rem)] overflow-y-auto overscroll-contain">
            {isLoading ? (
              <div className="space-y-1 p-2" aria-label="Loading notifications">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : data?.items.length ? (
              data.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => {
                    setOpen(false);
                    if (!item.readAt) void markRead(item.id);
                  }}
                  className={cn(
                    "flex min-h-[72px] gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/70",
                    !item.readAt && "bg-primary/[0.06]"
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0 border border-border">
                    <AvatarImage src={item.actor?.avatarUrl ?? ""} alt="" />
                    <AvatarFallback>{item.actor?.displayName.slice(0, 2).toUpperCase() ?? "U"}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{item.title}</span>
                      {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">{item.body}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground/80">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-6 py-10 text-center">
                <Bell className="mx-auto h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">Nothing new yet</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Messages and activity will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
