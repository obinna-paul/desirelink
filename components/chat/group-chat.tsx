"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import type { PresenceChannel } from "pusher-js";
import { ShieldOff, Trash2, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportDialog } from "@/components/safety/report-dialog";
import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher-client";
import {
  chatChannelName,
  GROUP_MESSAGE_DELETED_EVENT,
  NEW_GROUP_MESSAGE_EVENT,
  USER_MUTED_EVENT,
  USER_UNMUTED_EVENT,
  type ChannelType,
} from "@/lib/group-chat-channels";
import type { GroupMessageData } from "@/lib/group-chat";

type ChatMember = { id: string; username: string; displayName: string; avatarUrl: string };

export function GroupChat({
  channelType,
  channelId,
  viewerProfileId,
  initialMessages,
  canPost,
  isAdmin,
  initiallyMuted,
  moderationTargets = [],
  initialMutedUserIds = [],
}: {
  channelType: ChannelType;
  channelId: string;
  viewerProfileId: string;
  initialMessages: GroupMessageData[];
  canPost: boolean;
  isAdmin: boolean;
  initiallyMuted: boolean;
  moderationTargets?: ChatMember[];
  initialMutedUserIds?: string[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<GroupMessageData[]>(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(initiallyMuted);
  const [mutedUserIds, setMutedUserIds] = useState<Set<string>>(new Set(initialMutedUserIds));
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [presenceAvailable, setPresenceAvailable] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const apiBase = `/api/${channelType}s/${channelId}/chat`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channelName = chatChannelName(channelType, channelId);
    const channel = client.subscribe(channelName) as PresenceChannel;
    setPresenceAvailable(true);

    channel.bind("pusher:subscription_succeeded", () => {
      setOnlineCount(channel.members.count);
    });
    channel.bind("pusher:member_added", () => setOnlineCount(channel.members.count));
    channel.bind("pusher:member_removed", () => setOnlineCount(channel.members.count));

    function onNewMessage(incoming: GroupMessageData) {
      setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
    }
    function onMessageDeleted({ messageId }: { messageId: string }) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
    function onUserMuted({ userId }: { userId: string }) {
      setMutedUserIds((prev) => new Set(prev).add(userId));
      if (userId === viewerProfileId) setMuted(true);
    }
    function onUserUnmuted({ userId }: { userId: string }) {
      setMutedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      if (userId === viewerProfileId) setMuted(false);
    }

    channel.bind(NEW_GROUP_MESSAGE_EVENT, onNewMessage);
    channel.bind(GROUP_MESSAGE_DELETED_EVENT, onMessageDeleted);
    channel.bind(USER_MUTED_EVENT, onUserMuted);
    channel.bind(USER_UNMUTED_EVENT, onUserUnmuted);

    return () => {
      channel.unbind(NEW_GROUP_MESSAGE_EVENT, onNewMessage);
      channel.unbind(GROUP_MESSAGE_DELETED_EVENT, onMessageDeleted);
      channel.unbind(USER_MUTED_EVENT, onUserMuted);
      channel.unbind(USER_UNMUTED_EVENT, onUserUnmuted);
      channel.unbind("pusher:subscription_succeeded");
      channel.unbind("pusher:member_added");
      channel.unbind("pusher:member_removed");
      client.unsubscribe(channelName);
    };
  }, [channelType, channelId, viewerProfileId]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim() || sending) return;

    setSending(true);
    setError(null);

    const res = await fetch(`${apiBase}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const body = await res.json().catch(() => null);
    setSending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't send your message. Try again.");
      return;
    }

    setMessages((prev) => (prev.some((m) => m.id === body.message.id) ? prev : [...prev, body.message]));
    setContent("");
  }

  async function handleDeleteMessage(messageId: string) {
    const res = await fetch(`${apiBase}/messages/${messageId}`, { method: "DELETE" });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  }

  async function handleToggleMute(userId: string, isMuted: boolean) {
    setBusyUserId(userId);
    const res = isMuted
      ? await fetch(`${apiBase}/mute/${userId}`, { method: "DELETE" })
      : await fetch(`${apiBase}/mute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
    setBusyUserId(null);

    if (res.ok) {
      setMutedUserIds((prev) => {
        const next = new Set(prev);
        if (isMuted) next.delete(userId);
        else next.add(userId);
        return next;
      });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        {presenceAvailable && onlineCount !== null
          ? `${onlineCount} online now`
          : "Live presence unavailable in this environment"}
      </div>

      {isAdmin && moderationTargets.length > 0 && (
        <details className="rounded-xl border border-border/60 bg-card">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground [&::-webkit-details-marker]:hidden">
            Manage members ({moderationTargets.length})
          </summary>
          <ul className="flex flex-col gap-2 border-t border-border/60 p-3">
            {moderationTargets
              .filter((member) => member.id !== viewerProfileId)
              .map((member) => {
                const memberMuted = mutedUserIds.has(member.id);
                return (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="h-7 w-7 border border-border">
                        <AvatarImage src={member.avatarUrl} alt={member.displayName} />
                        <AvatarFallback className="text-[10px]">
                          {member.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">{member.displayName}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={memberMuted ? "default" : "outline"}
                      className="shrink-0 gap-1.5"
                      disabled={busyUserId === member.id}
                      onClick={() => handleToggleMute(member.id, memberMuted)}
                    >
                      <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                      {memberMuted ? "Unmute" : "Mute"}
                    </Button>
                  </li>
                );
              })}
          </ul>
        </details>
      )}

      <div
        ref={scrollRef}
        className="flex h-80 flex-col gap-2 overflow-y-auto rounded-xl border border-border/60 bg-card p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === viewerProfileId;
            const initials = message.sender.displayName.slice(0, 2).toUpperCase();
            return (
              <div key={message.id} className={cn("flex gap-2", isMine && "flex-row-reverse")}>
                <Avatar className="h-7 w-7 shrink-0 border border-border">
                  <AvatarImage src={message.sender.avatarUrl} alt={message.sender.displayName} />
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                <div className={cn("flex max-w-[75%] flex-col gap-0.5", isMine && "items-end")}>
                  <div className="flex items-center gap-1.5">
                    {!isMine && <span className="text-xs font-medium">{message.sender.displayName}</span>}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="group flex items-center gap-1.5">
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-1.5 text-sm",
                        isMine
                          ? "bg-gradient-to-r from-neon-pink to-neon-cyan text-background"
                          : "bg-secondary text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        aria-label="Delete message"
                        onClick={() => handleDeleteMessage(message.id)}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    {!isMine && (
                      <span className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <ReportDialog
                          targetType="group_message"
                          targetId={message.id}
                          label="Report message"
                          variant="icon"
                        />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canPost ? (
        <form onSubmit={handleSend} className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={muted ? "You've been muted in this chat" : "Send a message..."}
              disabled={muted || sending}
              className="min-h-[44px] flex-1 resize-none"
              rows={1}
              maxLength={1000}
            />
            <Button type="submit" disabled={muted || sending || !content.trim()}>
              {sending ? "..." : "Send"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {channelType === "event"
            ? "RSVP as Going to join the conversation."
            : "Join this room to send messages."}
        </p>
      )}
    </div>
  );
}
