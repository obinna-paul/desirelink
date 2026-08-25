"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher-client";
import { getUserChannelName, INBOX_UPDATED_EVENT } from "@/lib/message-channels";
import type { ConversationSummary } from "@/lib/messages";

function formatTimestamp(date: Date | string) {
  const value = new Date(date);
  const isToday = value.toDateString() === new Date().toDateString();
  return isToday
    ? value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ConversationList({
  conversations,
  viewerProfileId,
  activeUsername,
}: {
  conversations: ConversationSummary[];
  viewerProfileId: string;
  activeUsername?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channel = client.subscribe(getUserChannelName(viewerProfileId));
    channel.bind(INBOX_UPDATED_EVENT, () => router.refresh());

    return () => {
      channel.unbind(INBOX_UPDATED_EVENT);
      client.unsubscribe(getUserChannelName(viewerProfileId));
    };
  }, [viewerProfileId, router]);

  if (conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        No conversations yet. Message someone from their profile to get started.
      </div>
    );
  }

  return (
    <ul className="flex h-full flex-col overflow-y-auto">
      {conversations.map(({ counterpart, lastMessage, unreadCount }) => {
        const isActive = counterpart.username === activeUsername;
        const initials = counterpart.displayName.slice(0, 2).toUpperCase();

        return (
          <li key={counterpart.id}>
            <Link
              href={`/messages?with=${counterpart.username}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-secondary/60",
                isActive && "bg-secondary"
              )}
            >
              <Avatar className="h-10 w-10 shrink-0 border border-border">
                <AvatarImage src={counterpart.avatarUrl} alt={counterpart.displayName} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{counterpart.displayName}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatTimestamp(lastMessage.createdAt)}
                  </span>
                </div>
                <p
                  className={cn(
                    "truncate text-xs",
                    unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {lastMessage.isMine ? "You: " : ""}
                  {lastMessage.content}
                </p>
              </div>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
