"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, SquarePen } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher-client";
import { getUserChannelName, INBOX_UPDATED_EVENT } from "@/lib/message-channels";
import type { ConversationSummary } from "@/lib/message-types";

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
  const [query, setQuery] = useState("");
  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter(({ counterpart }) =>
      `${counterpart.displayName} ${counterpart.username}`.toLowerCase().includes(normalized)
    );
  }, [conversations, query]);

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

  return (
    <div className="chat-theme flex h-full flex-col bg-[hsl(var(--chat-header))]">
      <div className="border-b border-[hsl(var(--chat-border))] px-4 pb-3 pt-4 md:px-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Messages</h1>
          <Link
            href="/discover"
            aria-label="Start a new conversation"
            title="Start a new conversation"
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-[hsl(var(--chat-incoming))]"
          >
            <SquarePen className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl bg-[hsl(var(--chat-composer))] px-3 text-muted-foreground ring-1 ring-transparent focus-within:ring-[hsl(var(--chat-outgoing)/0.35)]">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Search conversations</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>
      {conversations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm leading-6 text-muted-foreground">
          Find someone in Discover and start a conversation from their profile.
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No conversations match “{query}”.</div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1.5">
          {filteredConversations.map(({ counterpart, lastMessage, unreadCount }) => {
            const isActive = counterpart.username === activeUsername;
            const initials = counterpart.displayName.slice(0, 2).toUpperCase();

            return (
              <li key={counterpart.id}>
                <Link
                  href={`/messages?with=${counterpart.username}`}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "mx-2 flex min-h-[72px] items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-[hsl(var(--chat-incoming)/0.72)] md:min-h-[68px] md:px-3",
                    isActive && "bg-[hsl(var(--chat-incoming))]"
                  )}
                >
                  <Avatar className="h-12 w-12 shrink-0 border border-[hsl(var(--chat-border))] md:h-11 md:w-11">
                    <AvatarImage src={counterpart.avatarUrl} alt={counterpart.displayName} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-sm", unreadCount > 0 ? "font-bold" : "font-semibold")}>{counterpart.username}</p>
                      <span className={cn("shrink-0 text-[11px]", unreadCount > 0 ? "font-semibold text-[hsl(var(--chat-outgoing))]" : "text-muted-foreground")}>
                        {formatTimestamp(lastMessage.createdAt)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-sm md:text-xs",
                        unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {lastMessage.isMine ? "You: " : ""}
                      {lastMessage.content}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--chat-outgoing))] px-1 text-[11px] font-semibold text-[hsl(var(--chat-outgoing-foreground))]">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
