"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldX, Send } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportDialog } from "@/components/safety/report-dialog";
import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher-client";
import {
  getConversationChannelName,
  MESSAGES_READ_EVENT,
  NEW_MESSAGE_EVENT,
} from "@/lib/message-channels";
import { CONNECTION_REASONS, type ConversationMessage, type ConversationParticipant } from "@/lib/messages";

type Message = ConversationMessage;

function formatMessageTime(date: Date | string) {
  return new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ChatWindow({
  viewerProfileId,
  counterpart,
  initialMessages,
  blocked = false,
}: {
  viewerProfileId: string;
  counterpart: ConversationParticipant;
  initialMessages: Message[];
  blocked?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [content, setContent] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isNewConversation = messages.length === 0;

  useEffect(() => {
    setMessages(initialMessages);
    setReason(null);
    setContent("");
  }, [counterpart.id, initialMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channelName = getConversationChannelName(viewerProfileId, counterpart.id);
    const channel = client.subscribe(channelName);

    channel.bind(NEW_MESSAGE_EVENT, (incoming: Message) => {
      setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
    });

    channel.bind(MESSAGES_READ_EVENT, ({ readerId, readAt }: { readerId: string; readAt: string }) => {
      if (readerId === viewerProfileId) return;
      setMessages((prev) =>
        prev.map((m) => (m.senderId === viewerProfileId && !m.readAt ? { ...m, readAt: new Date(readAt) } : m))
      );
    });

    return () => {
      channel.unbind(NEW_MESSAGE_EVENT);
      channel.unbind(MESSAGES_READ_EVENT);
      client.unsubscribe(channelName);
    };
  }, [viewerProfileId, counterpart.id]);

  function pickReason(value: string, template: string) {
    setReason(value);
    setContent(template);
  }

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: counterpart.id, content: trimmed }),
    });
    const body = await res.json().catch(() => null);
    setSending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't send your message. Try again.");
      return;
    }

    setMessages((prev) => (prev.some((m) => m.id === body.message.id) ? prev : [...prev, body.message]));
    setContent("");
    setReason(null);
    router.refresh();
  }

  const lastMineIndex = [...messages].map((m) => m.senderId).lastIndexOf(viewerProfileId);
  const lastMineRead = lastMineIndex >= 0 ? Boolean(messages[lastMineIndex].readAt) : false;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={counterpart.avatarUrl} alt={counterpart.displayName} />
            <AvatarFallback className="text-xs">
              {counterpart.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{counterpart.displayName}</p>
            <p className="text-xs text-muted-foreground">@{counterpart.username}</p>
          </div>
        </div>
        <ReportDialog targetType="profile" targetId={counterpart.id} label={`Report ${counterpart.displayName}`} variant="icon" />
      </div>

      {blocked && (
        <p className="flex items-center gap-1.5 border-b border-border/60 bg-secondary/60 px-4 py-2 text-xs text-muted-foreground">
          <ShieldX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          You can&apos;t message this user.
        </p>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Say hello to {counterpart.displayName} — pick a reason below to get started.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((message) => {
              const isMine = message.senderId === viewerProfileId;
              return (
                <li key={message.id} className={cn("group flex items-end gap-1.5", isMine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                      isMine
                        ? "bg-gradient-to-r from-neon-pink to-neon-cyan text-background"
                        : "bg-secondary text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        isMine ? "text-background/70" : "text-muted-foreground"
                      )}
                    >
                      {formatMessageTime(message.createdAt)}
                    </p>
                  </div>
                  {!isMine && (
                    <span className="opacity-0 transition-opacity group-hover:opacity-100">
                      <ReportDialog
                        targetType="message"
                        targetId={message.id}
                        label="Report message"
                        variant="icon"
                      />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isNewConversation && !blocked && (
        <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Why are you reaching out?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CONNECTION_REASONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={reason === option.value}
                onClick={() => pickReason(option.value, option.template)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-3 text-xs transition-colors",
                  reason === option.value
                    ? "border-transparent bg-gradient-to-r from-neon-pink to-neon-cyan text-background"
                    : "border-border/60 bg-card text-muted-foreground hover:border-neon-pink/60 hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border/60 p-4">
        {error && (
          <p role="alert" className="mb-2 text-xs text-destructive">
            {error}
          </p>
        )}
        {!isNewConversation && lastMineRead && (
          <p className="mb-1.5 text-right text-[10px] text-muted-foreground">Seen</p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              blocked
                ? "You can't message this user"
                : isNewConversation && !reason
                  ? "Pick a reason above to get started"
                  : "Write a message..."
            }
            disabled={blocked || (isNewConversation && !reason)}
            className="min-h-[44px] flex-1 resize-none"
            rows={1}
          />
          <Button
            type="button"
            size="icon"
            aria-label="Send message"
            disabled={blocked || sending || !content.trim() || (isNewConversation && !reason)}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
