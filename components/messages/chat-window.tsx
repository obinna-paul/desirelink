"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Heart, Reply, Send, ShieldX, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportDialog } from "@/components/safety/report-dialog";
import { GiftPicker, type SendGiftOutcome } from "@/components/hearts/gift-picker";
import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher-client";
import { isProviderProfileType } from "@/lib/provider-types";
import {
  getConversationChannelName,
  MESSAGES_READ_EVENT,
  NEW_MESSAGE_EVENT,
  TYPING_EVENT,
} from "@/lib/message-channels";
import { CONNECTION_REASONS, type ConversationMessage, type ConversationParticipant } from "@/lib/message-types";

type Message = ConversationMessage;

function formatMessageTime(date: Date | string) {
  return new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ChatWindow({
  viewerProfileId,
  counterpart,
  initialMessages,
  blocked = false,
  viewerHeartsBalance = 0,
}: {
  viewerProfileId: string;
  counterpart: ConversationParticipant;
  initialMessages: Message[];
  blocked?: boolean;
  viewerHeartsBalance?: number;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [content, setContent] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [counterpartTyping, setCounterpartTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef(false);
  const counterpartTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counterpartIsProvider = isProviderProfileType(counterpart.profileType);

  async function sendHearts(hearts: number): Promise<SendGiftOutcome> {
    const res = await fetch(`/api/providers/${counterpart.id}/gift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearts, context: "chat" }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: body?.error ?? "Couldn't send that gift." };
    }
    return { ok: true, heartsBalance: body.heartsBalance };
  }

  const isNewConversation = messages.length === 0;

  useEffect(() => {
    setMessages(initialMessages);
    setReason(null);
    setContent("");
    setReplyingTo(null);
    setCounterpartTyping(false);
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
    channel.bind(TYPING_EVENT, ({ profileId, isTyping }: { profileId: string; isTyping: boolean }) => {
      if (profileId !== counterpart.id) return;
      setCounterpartTyping(isTyping);
      if (counterpartTypingTimeoutRef.current) clearTimeout(counterpartTypingTimeoutRef.current);
      if (isTyping) {
        counterpartTypingTimeoutRef.current = setTimeout(() => setCounterpartTyping(false), 2200);
      }
    });

    return () => {
      channel.unbind(NEW_MESSAGE_EVENT);
      channel.unbind(MESSAGES_READ_EVENT);
      channel.unbind(TYPING_EVENT);
      client.unsubscribe(channelName);
      if (counterpartTypingTimeoutRef.current) clearTimeout(counterpartTypingTimeoutRef.current);
    };
  }, [viewerProfileId, counterpart.id]);

  function sendTypingState(isTyping: boolean) {
    fetch("/api/messages/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: counterpart.id, isTyping }),
    }).catch(() => undefined);
  }

  function handleContentChange(value: string) {
    setContent(value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    const isTyping = value.trim().length > 0;
    if (isTyping && !typingSentRef.current) {
      typingSentRef.current = true;
      sendTypingState(true);
    }
    if (!isTyping && typingSentRef.current) {
      typingSentRef.current = false;
      sendTypingState(false);
      return;
    }
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        typingSentRef.current = false;
        sendTypingState(false);
      }, 1400);
    }
  }

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
      body: JSON.stringify({ recipientId: counterpart.id, content: trimmed, replyToId: replyingTo?.id ?? null }),
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
    setReplyingTo(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingSentRef.current) sendTypingState(false);
    typingSentRef.current = false;
    router.refresh();
  }

  const lastMineIndex = [...messages].map((m) => m.senderId).lastIndexOf(viewerProfileId);
  const lastMineRead = lastMineIndex >= 0 ? Boolean(messages[lastMineIndex].readAt) : false;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[64px] items-center justify-between gap-2 border-b border-border/60 px-2 py-2.5 md:px-4">
        <div className="flex min-w-0 items-center gap-1 md:gap-3">
          <Link
            href="/messages"
            aria-label="Back to messages"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-secondary md:hidden"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </Link>
          <Link href={`/profile/${counterpart.username}`} className="flex min-w-0 items-center gap-2.5 rounded-lg p-1 hover:bg-secondary/70">
            <Avatar className="h-10 w-10 shrink-0 border border-border">
              <AvatarImage src={counterpart.avatarUrl} alt={counterpart.displayName} />
              <AvatarFallback className="text-xs">
                {counterpart.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{counterpart.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {counterpartTyping ? "typing…" : `@${counterpart.username}`}
              </p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          {counterpartIsProvider && !blocked && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 w-10 rounded-full p-0 md:h-9 md:w-auto md:rounded-md md:px-3"
              aria-pressed={giftPickerOpen}
              aria-label="Send hearts"
              title="Send hearts"
              onClick={() => setGiftPickerOpen((open) => !open)}
            >
              <Heart className="h-3.5 w-3.5 text-neon-pink" aria-hidden="true" fill="currentColor" />
              <span className="hidden md:inline">Send hearts</span>
            </Button>
          )}
          <ReportDialog targetType="profile" targetId={counterpart.id} label={`Report ${counterpart.displayName}`} variant="icon" />
        </div>
      </div>

      {giftPickerOpen && counterpartIsProvider && (
        <div className="border-b border-border/60 bg-secondary/30 px-3 py-3 md:px-4">
          <GiftPicker initialBalance={viewerHeartsBalance} onSend={sendHearts} />
        </div>
      )}

      {blocked && (
        <p className="flex items-center gap-1.5 border-b border-border/60 bg-secondary/60 px-4 py-2 text-xs text-muted-foreground">
          <ShieldX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          You can&apos;t message this user.
        </p>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-background/40 px-3 py-4 md:px-5 md:py-5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm leading-6 text-muted-foreground">
            Say hello to {counterpart.displayName}. Pick a reason below to get started.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {messages.map((message) => {
              const isMine = message.senderId === viewerProfileId;
              return (
                <li key={message.id} className={cn("group flex items-end gap-1", isMine ? "justify-end" : "justify-start")}>
                  {!isMine && (
                    <button
                      type="button"
                      onClick={() => setReplyingTo(message)}
                      aria-label="Reply to message"
                      title="Reply"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground opacity-100 hover:bg-secondary hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    >
                      <Reply className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 md:max-w-[70%]",
                      isMine
                        ? "rounded-br-md bg-foreground text-background"
                        : "rounded-bl-md border border-border/50 bg-card text-foreground shadow-sm"
                    )}
                  >
                    {message.replyTo && (
                      <div
                        className={cn(
                          "mb-1.5 border-l-2 pl-2 text-xs",
                          isMine ? "border-background/50 text-background/70" : "border-primary/60 text-muted-foreground"
                        )}
                      >
                        <p className="font-medium">
                          {message.replyTo.senderId === viewerProfileId ? "You" : counterpart.displayName}
                        </p>
                        <p className="line-clamp-2">{message.replyTo.content}</p>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        isMine ? "text-background/60" : "text-muted-foreground"
                      )}
                    >
                      {formatMessageTime(message.createdAt)}
                    </p>
                  </div>
                  {!isMine && (
                    <span className="opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      <ReportDialog
                        targetType="message"
                        targetId={message.id}
                        label="Report message"
                        variant="icon"
                      />
                    </span>
                  )}
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => setReplyingTo(message)}
                      aria-label="Reply to message"
                      title="Reply"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground opacity-100 hover:bg-secondary hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    >
                      <Reply className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {counterpartTyping && (
          <div className="mt-2 flex w-fit items-center gap-1 rounded-2xl rounded-bl-md border border-border/50 bg-card px-3.5 py-3 shadow-sm" aria-label={`${counterpart.displayName} is typing`}>
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${dot * 140}ms` }} />
            ))}
          </div>
        )}
      </div>

      {isNewConversation && !blocked && (
        <div className="flex flex-col gap-2 border-t border-border/60 px-3 py-3 md:px-4">
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
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border/60 bg-card text-muted-foreground hover:border-neon-pink/60 hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border/60 bg-card px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:p-4">
        {error && (
          <p role="alert" className="mb-2 text-xs text-destructive">
            {error}
          </p>
        )}
        {!isNewConversation && lastMineRead && (
          <p className="mb-1.5 text-right text-[10px] text-muted-foreground">Seen</p>
        )}
        {replyingTo && (
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-secondary/80 px-3 py-2">
            <Reply className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">
                Replying to {replyingTo.senderId === viewerProfileId ? "yourself" : counterpart.displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{replyingTo.content}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-background"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              blocked
                ? "You cannot message this user"
                : isNewConversation && !reason
                  ? "Pick a reason above to get started"
                  : "Write a message..."
            }
            disabled={blocked || (isNewConversation && !reason)}
            className="min-h-[46px] max-h-32 flex-1 resize-none rounded-[23px] border-border/70 bg-secondary/55 px-4 py-3 focus-visible:bg-background"
            rows={1}
          />
          <Button
            type="button"
            size="icon"
            aria-label="Send message"
            disabled={blocked || sending || !content.trim() || (isNewConversation && !reason)}
            onClick={handleSend}
            className="h-11 w-11 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
