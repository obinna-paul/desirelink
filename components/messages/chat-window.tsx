"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ChevronDown,
  ChevronLeft,
  Copy,
  EllipsisVertical,
  Flag,
  Heart,
  ImagePlus,
  Loader2,
  Mic,
  Reply,
  Send,
  ShieldX,
  UserRound,
  X,
} from "lucide-react";

import { GiftPicker, type SendGiftOutcome } from "@/components/hearts/gift-picker";
import { MessageBubble } from "@/components/messages/message-bubble";
import { ReportDialog } from "@/components/safety/report-dialog";
import { BlockButton } from "@/components/safety/block-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BlockRelationship } from "@/lib/block";
import {
  getConversationChannelName,
  MESSAGES_READ_EVENT,
  NEW_MESSAGE_EVENT,
  TYPING_EVENT,
} from "@/lib/message-channels";
import {
  CONNECTION_REASONS,
  type ConversationMedia,
  type ConversationMessage,
  type ConversationParticipant,
} from "@/lib/message-types";
import { getPusherClient } from "@/lib/pusher-client";
import { isProviderProfileType } from "@/lib/provider-types";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { uploadMediaDirectToCloudinary } from "@/lib/client-uploads";
import { cn } from "@/lib/utils";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const MAX_VOICE_NOTE_SECONDS = 10 * 60;

type PresenceResponse = {
  visible: boolean;
  state: "online" | "offline" | "hidden";
  lastActiveAt: string | null;
};

async function fetchPresence(url: string): Promise<PresenceResponse> {
  const response = await fetch(url);
  if (!response.ok) return { visible: false, state: "hidden", lastActiveAt: null };
  return response.json();
}

function formatActivity(lastActiveAt: string | null) {
  if (!lastActiveAt) return null;
  const value = new Date(lastActiveAt);
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - value.getTime()) / 60_000));
  if (elapsedMinutes < 60) return `Active ${elapsedMinutes}m ago`;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (value.toDateString() === today.toDateString()) {
    return `Active ${value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  if (value.toDateString() === yesterday.toDateString()) return "Active yesterday";
  return `Active ${value.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

function getDateLabel(current: ConversationMessage, previous?: ConversationMessage) {
  const currentDate = new Date(current.createdAt);
  if (previous && currentDate.toDateString() === new Date(previous.createdAt).toDateString()) return null;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (currentDate.toDateString() === today.toDateString()) return "Today";
  if (currentDate.toDateString() === yesterday.toDateString()) return "Yesterday";
  return currentDate.toLocaleDateString([], { month: "short", day: "numeric", year: currentDate.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function isGrouped(first: ConversationMessage, second: ConversationMessage) {
  return first.senderId === second.senderId && Math.abs(new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()) <= GROUP_WINDOW_MS;
}

function formatRecordingTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ChatWindow({
  viewerProfileId,
  counterpart,
  initialMessages,
  blockRelationship = "none",
  viewerHeartsBalance = 0,
}: {
  viewerProfileId: string;
  counterpart: ConversationParticipant;
  initialMessages: ConversationMessage[];
  blockRelationship?: BlockRelationship;
  viewerHeartsBalance?: number;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ConversationMessage | null>(null);
  const [actionMessage, setActionMessage] = useState<ConversationMessage | null>(null);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [counterpartTyping, setCounterpartTyping] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [pendingMedia, setPendingMedia] = useState<ConversationMedia | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionSheetRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef(false);
  const counterpartTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const previousScrollHeightRef = useRef(0);
  const previousFirstMessageIdRef = useRef(initialMessages[0]?.id);
  const initialMessagesRef = useRef(initialMessages);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const sendRecordedVoiceRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef(0);

  const blocked = blockRelationship !== "none";
  const counterpartIsProvider = isProviderProfileType(counterpart.profileType);
  initialMessagesRef.current = initialMessages;
  const { data: presence } = useSWR(
    `/api/messages/presence?profileId=${encodeURIComponent(counterpart.id)}`,
    fetchPresence,
    { refreshInterval: 30_000, revalidateOnFocus: true }
  );

  useFocusTrap(Boolean(actionMessage), actionSheetRef);

  const activityText = counterpartTyping
    ? `${counterpart.displayName} is typing...`
    : presence?.visible && presence.state === "online"
      ? "Online"
      : presence?.visible
        ? formatActivity(presence.lastActiveAt)
        : null;

  const latestOutgoingId = useMemo(
    () => [...messages].reverse().find((message) => message.senderId === viewerProfileId)?.id ?? null,
    [messages, viewerProfileId]
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    nearBottomRef.current = true;
    setNewMessageCount(0);
  }, []);

  useEffect(() => {
    const nextMessages = initialMessagesRef.current;
    setMessages(nextMessages);
    setContent("");
    setReplyingTo(null);
    setCounterpartTyping(false);
    setNewMessageCount(0);
    initialScrollDoneRef.current = false;
    previousFirstMessageIdRef.current = nextMessages[0]?.id;
  }, [counterpart.id]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    setMessages((current) => {
      const merged = new Map(current.map((message) => [message.id, message]));
      initialMessages.forEach((message) => merged.set(message.id, message));
      return Array.from(merged.values()).sort(
        (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
      );
    });

    if (!initialScrollDoneRef.current) {
      requestAnimationFrame(() => scrollToBottom("auto"));
      initialScrollDoneRef.current = true;
      previousScrollHeightRef.current = container.scrollHeight;
      return;
    }

    const nextFirstId = initialMessages[0]?.id;
    const olderMessagesAdded = previousFirstMessageIdRef.current && nextFirstId !== previousFirstMessageIdRef.current;
    if (olderMessagesAdded) {
      const previousHeight = previousScrollHeightRef.current;
      requestAnimationFrame(() => {
        const current = scrollRef.current;
        if (current) current.scrollTop += current.scrollHeight - previousHeight;
      });
    }
    previousFirstMessageIdRef.current = nextFirstId;
    previousScrollHeightRef.current = container.scrollHeight;
  }, [initialMessages, scrollToBottom]);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channelName = getConversationChannelName(viewerProfileId, counterpart.id);
    const channel = client.subscribe(channelName);
    const clearRemoteTyping = () => setCounterpartTyping(false);

    channel.bind(NEW_MESSAGE_EVENT, (incoming: ConversationMessage) => {
      setMessages((current) => (current.some((message) => message.id === incoming.id) ? current : [...current, incoming]));
      setCounterpartTyping(false);
      if (incoming.senderId === viewerProfileId || nearBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom(incoming.senderId === viewerProfileId ? "smooth" : "auto"));
      } else {
        setNewMessageCount((count) => count + 1);
      }
    });

    channel.bind(MESSAGES_READ_EVENT, ({ readerId, readAt }: { readerId: string; readAt: string }) => {
      if (readerId === viewerProfileId) return;
      setMessages((current) =>
        current.map((message) =>
          message.senderId === viewerProfileId && !message.readAt ? { ...message, readAt: new Date(readAt) } : message
        )
      );
    });

    channel.bind(TYPING_EVENT, ({ profileId, isTyping }: { profileId: string; isTyping: boolean }) => {
      if (profileId !== counterpart.id) return;
      setCounterpartTyping(isTyping);
      if (counterpartTypingTimeoutRef.current) clearTimeout(counterpartTypingTimeoutRef.current);
      if (isTyping) counterpartTypingTimeoutRef.current = setTimeout(clearRemoteTyping, 2_400);
    });
    client.connection.bind("disconnected", clearRemoteTyping);

    return () => {
      channel.unbind(NEW_MESSAGE_EVENT);
      channel.unbind(MESSAGES_READ_EVENT);
      channel.unbind(TYPING_EVENT);
      client.connection.unbind("disconnected", clearRemoteTyping);
      client.unsubscribe(channelName);
      if (counterpartTypingTimeoutRef.current) clearTimeout(counterpartTypingTimeoutRef.current);
    };
  }, [viewerProfileId, counterpart.id, scrollToBottom]);

  useEffect(() => {
    if (!actionMessage) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActionMessage(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actionMessage]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingSentRef.current) {
      fetch("/api/messages/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: counterpart.id, isTyping: false }),
        keepalive: true,
      }).catch(() => undefined);
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, [counterpart.id]);

  function sendTypingState(isTyping: boolean) {
    fetch("/api/messages/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: counterpart.id, isTyping }),
    }).catch(() => undefined);
  }

  function handleContentChange(value: string) {
    setContent(value);
    setError(null);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }

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
      }, 1_400);
    }
  }

  function startReply(message: ConversationMessage) {
    setActionMessage(null);
    setReplyingTo(message);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function copyMessage(message: ConversationMessage) {
    await navigator.clipboard.writeText(message.content);
    setActionMessage(null);
  }

  async function uploadMessageMedia(file: File): Promise<ConversationMedia | null> {
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    const purpose = isVideo ? "message-video" : isAudio ? "message-audio" : "message-image";

    try {
      const media = await uploadMediaDirectToCloudinary(file, purpose, "/api/upload/message-media");
      return {
        url: media.url,
        type: isVideo ? "video" : isAudio ? "audio" : "image",
        mimeType: file.type,
        width: media.width ?? null,
        height: media.height ?? null,
        durationSeconds: media.durationSeconds ?? null,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      return null;
    }
  }

  async function handleMediaSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Choose a photo or video.");
      return;
    }

    setError(null);
    setUploadingMedia(true);
    const media = await uploadMessageMedia(file);
    setUploadingMedia(false);
    if (media) setPendingMedia(media);
  }

  function finishRecording(send: boolean) {
    sendRecordedVoiceRef.current = send;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordingStreamRef.current = stream;
      recordedChunksRef.current = [];
      sendRecordedVoiceRef.current = false;
      setRecordingSeconds(0);
      recordingDurationRef.current = 0;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        setRecording(false);

        if (!sendRecordedVoiceRef.current || recordedChunksRef.current.length === 0) {
          recordedChunksRef.current = [];
          return;
        }

        const baseType = (recorder.mimeType || recordedChunksRef.current[0].type || "audio/webm").split(";")[0];
        const extension = baseType.includes("mp4") ? "m4a" : baseType.includes("mpeg") ? "mp3" : "webm";
        const blob = new Blob(recordedChunksRef.current, { type: baseType });
        recordedChunksRef.current = [];
        setUploadingMedia(true);
        const media = await uploadMessageMedia(new File([blob], `voice-note.${extension}`, { type: baseType }));
        if (media) {
          await sendMessagePayload({
            ...media,
            durationSeconds: media.durationSeconds ?? recordingDurationRef.current,
          });
        }
        setUploadingMedia(false);
        setRecordingSeconds(0);
      };

      recorder.start(250);
      setRecording(true);
      const startedAt = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        recordingDurationRef.current = elapsed;
        setRecordingSeconds(elapsed);
        if (elapsed >= MAX_VOICE_NOTE_SECONDS) {
          sendRecordedVoiceRef.current = true;
          if (recorder.state !== "inactive") recorder.stop();
        }
      }, 500);
    } catch (error) {
      setRecording(false);
      setError(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone access is needed to record a voice note."
        : "Couldn't start voice recording. Try again.");
    }
  }

  async function sendHearts(hearts: number): Promise<SendGiftOutcome> {
    const response = await fetch(`/api/providers/${counterpart.id}/gift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearts, context: "chat" }),
    });
    const body = await response.json().catch(() => null);
    return response.ok
      ? { ok: true, heartsBalance: body.heartsBalance }
      : { ok: false, error: body?.error ?? "Couldn't send that gift." };
  }

  async function sendMessagePayload(mediaOverride?: ConversationMedia | null) {
    const trimmed = content.trim();
    const media = mediaOverride ?? pendingMedia;
    if ((!trimmed && !media) || sending || blocked) return;

    setSending(true);
    setError(null);
    const response = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: counterpart.id,
        content: trimmed,
        replyToId: replyingTo?.id ?? null,
        media,
      }),
    });
    const body = await response.json().catch(() => null);
    setSending(false);

    if (!response.ok) {
      setError(body?.error ?? "Couldn't send your message. Try again.");
      return;
    }

    setMessages((current) => (current.some((message) => message.id === body.message.id) ? current : [...current, body.message]));
    setContent("");
    setPendingMedia(null);
    setReplyingTo(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingSentRef.current) sendTypingState(false);
    typingSentRef.current = false;
    requestAnimationFrame(() => scrollToBottom());
    router.refresh();
  }

  return (
    <section className="chat-theme relative flex h-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--chat-canvas))] text-foreground">
      <header className="relative z-20 flex min-h-[64px] shrink-0 items-center justify-between gap-2 border-b border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-header)/0.96)] px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur md:px-4 md:pt-2">
        <div className="flex min-w-0 items-center gap-1 md:gap-2">
          <Link href="/messages" aria-label="Back to messages" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[hsl(var(--chat-incoming))] md:hidden">
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </Link>
          <Link href={`/profile/${counterpart.username}`} className="flex min-w-0 items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-[hsl(var(--chat-incoming)/0.72)]">
            <Avatar className="h-10 w-10 shrink-0 border border-[hsl(var(--chat-border))]">
              <AvatarImage src={counterpart.avatarUrl} alt={counterpart.displayName} />
              <AvatarFallback className="text-xs">{counterpart.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-[15px] font-semibold leading-5">{counterpart.displayName}</p>
                {presence?.visible && presence.state === "online" && !counterpartTyping && <span className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--chat-status))]" aria-label="Online" />}
              </div>
              <p className={cn("truncate text-xs", counterpartTyping || presence?.state === "online" ? "text-[hsl(var(--chat-status))]" : "text-muted-foreground")} aria-live="polite">
                {activityText ?? `@${counterpart.username}`}
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-0.5">
          {counterpartIsProvider && !blocked && (
            <button type="button" aria-label="Send hearts" aria-expanded={giftPickerOpen} onClick={() => setGiftPickerOpen((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-full text-[hsl(var(--chat-outgoing))] transition-colors hover:bg-[hsl(var(--chat-incoming))]">
              <Heart className="h-5 w-5" fill="currentColor" aria-hidden="true" />
            </button>
          )}
          <div className="relative">
            <button type="button" aria-label="Conversation options" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[hsl(var(--chat-incoming))]">
              <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-header))] p-1.5 shadow-lg">
                <Link href={`/profile/${counterpart.username}`} onClick={() => setProfileMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-[hsl(var(--chat-incoming))]">
                  <UserRound className="h-4 w-4" aria-hidden="true" /> View profile
                </Link>
                <ReportDialog targetType="profile" targetId={counterpart.id} label={`Report ${counterpart.displayName}`} menu />
                {blockRelationship !== "blocked_by_them" && (
                  <BlockButton profileId={counterpart.id} initiallyBlocked={blockRelationship === "blocked_by_me"} menu />
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {giftPickerOpen && counterpartIsProvider && (
        <div className="z-10 shrink-0 border-b border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-header))] px-4 py-3">
          <GiftPicker initialBalance={viewerHeartsBalance} onSend={sendHearts} />
        </div>
      )}

      {blocked && (
        <p className="flex shrink-0 items-center justify-center gap-2 border-b border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-incoming))] px-4 py-2.5 text-xs text-muted-foreground">
          <ShieldX className="h-4 w-4" aria-hidden="true" />
          {blockRelationship === "blocked_by_me" ? "You blocked this account." : "Messaging is unavailable."}
        </p>
      )}

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const target = event.currentTarget;
          nearBottomRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 96;
          if (nearBottomRef.current && newMessageCount) setNewMessageCount(0);
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-6 md:py-5"
      >
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center px-6 text-center">
            <Avatar className="mb-4 h-16 w-16 border border-[hsl(var(--chat-border))]">
              <AvatarImage src={counterpart.avatarUrl} alt="" />
              <AvatarFallback>{counterpart.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="text-base font-semibold">Start a conversation</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Send {counterpart.displayName} a message when you are ready.</p>
          </div>
        ) : (
          <ul className="mx-auto flex w-full max-w-3xl flex-col gap-1">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const next = messages[index + 1];
              const isMine = message.senderId === viewerProfileId;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  viewerProfileId={viewerProfileId}
                  counterpartName={counterpart.displayName}
                  isMine={isMine}
                  groupStart={!previous || !isGrouped(previous, message)}
                  groupEnd={!next || !isGrouped(message, next)}
                  dateLabel={getDateLabel(message, previous)}
                  showSeen={message.id === latestOutgoingId && isMine && Boolean(message.readAt)}
                  onReply={startReply}
                  onActions={setActionMessage}
                />
              );
            })}
            {counterpartTyping && (
              <li className="mt-1 flex justify-start" aria-live="polite" aria-label={`${counterpart.displayName} is typing`}>
                <div className="flex h-10 items-center gap-1 rounded-[15px] rounded-bl-[6px] bg-[hsl(var(--chat-incoming))] px-4">
                  {[0, 1, 2].map((dot) => <span key={dot} className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${dot * 130}ms` }} />)}
                </div>
              </li>
            )}
          </ul>
        )}
      </div>

      {newMessageCount > 0 && (
        <button type="button" onClick={() => scrollToBottom()} className="absolute bottom-24 left-1/2 z-20 flex min-h-10 -translate-x-1/2 items-center gap-2 rounded-full border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-header))] px-4 text-xs font-semibold shadow-lg">
          {newMessageCount === 1 ? "New message" : `${newMessageCount} new messages`}
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {!blocked && messages.length === 0 && content.length === 0 && (
        <div className="shrink-0 border-t border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-header))] px-3 py-2.5 md:px-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Need an opener?</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CONNECTION_REASONS.slice(0, 4).map((option) => (
              <button key={option.value} type="button" onClick={() => handleContentChange(option.template)} className="min-h-10 shrink-0 rounded-full border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-canvas))] px-3.5 text-xs font-medium transition-colors hover:bg-[hsl(var(--chat-incoming))]">
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <footer className="shrink-0 border-t border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-header))] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 md:px-5 md:pb-4 md:pt-3">
        {error && <p role="alert" className="mx-auto mb-2 max-w-3xl text-xs text-destructive">{error}</p>}
        {uploadingMedia && (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl bg-[hsl(var(--chat-incoming))] px-3 py-2.5 text-xs font-medium text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Preparing your media...
          </div>
        )}
        {pendingMedia && !recording && (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-xl bg-[hsl(var(--chat-incoming))] p-2">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/90">
              {pendingMedia.type === "image" ? (
                <Image src={pendingMedia.url} alt="Photo ready to send" fill sizes="56px" className="object-cover" />
              ) : (
                <video src={pendingMedia.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{pendingMedia.type === "image" ? "Photo ready" : "Video ready"}</p>
              <p className="text-xs text-muted-foreground">Add a message, or send it as is.</p>
            </div>
            <button type="button" onClick={() => setPendingMedia(null)} aria-label="Remove attachment" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[hsl(var(--chat-canvas))]">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        {replyingTo && (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-xl bg-[hsl(var(--chat-incoming))] px-3 py-2">
            <Reply className="h-4 w-4 shrink-0 text-[hsl(var(--chat-outgoing))]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">Replying to {replyingTo.senderId === viewerProfileId ? "yourself" : counterpart.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {replyingTo.content || (replyingTo.mediaType === "audio" ? "Voice note" : replyingTo.mediaType === "video" ? "Video" : "Photo")}
              </p>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[hsl(var(--chat-canvas))]">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={handleMediaSelected} />
        {recording ? (
          <div className="mx-auto flex min-h-12 max-w-3xl items-center gap-2 rounded-2xl bg-[hsl(var(--chat-composer))] px-2 py-1.5">
            <button type="button" onClick={() => finishRecording(false)} aria-label="Cancel voice note" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-[hsl(var(--chat-canvas))]">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3" aria-live="polite">
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
              <span className="w-10 shrink-0 text-sm font-semibold tabular-nums">{formatRecordingTime(recordingSeconds)}</span>
              <span className="flex h-6 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden" aria-hidden="true">
                {[10, 18, 13, 22, 16, 24, 12, 19, 14, 21, 11, 17].map((height, index) => (
                  <span key={index} className="chat-recording-bar w-1 rounded-full bg-[hsl(var(--chat-outgoing)/0.55)]" style={{ height, animationDelay: `${index * 70}ms` }} />
                ))}
              </span>
            </div>
            <Button type="button" size="icon" aria-label="Send voice note" onClick={() => finishRecording(true)} className="h-10 w-10 shrink-0 bg-[hsl(var(--chat-outgoing))] text-white shadow-none hover:bg-[hsl(var(--chat-outgoing)/0.9)]">
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl items-end gap-1.5">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={blocked || uploadingMedia || sending} aria-label="Add photo or video" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[hsl(var(--chat-outgoing))] transition-colors hover:bg-[hsl(var(--chat-incoming))] disabled:opacity-40">
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
            </button>
            <Textarea
              ref={textareaRef}
              rows={1}
              value={content}
              disabled={blocked || uploadingMedia}
              onChange={(event) => handleContentChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessagePayload();
                }
              }}
              placeholder={blocked ? "Messaging unavailable" : "Message..."}
              className="max-h-[120px] min-h-11 flex-1 resize-none overflow-y-auto rounded-[22px] border-0 bg-[hsl(var(--chat-composer))] px-4 py-3 text-[15px] leading-5 shadow-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--chat-outgoing)/0.5)]"
            />
            {content.trim() || pendingMedia ? (
              <Button type="button" size="icon" aria-label="Send message" disabled={blocked || sending || uploadingMedia} onClick={() => sendMessagePayload()} className="h-11 w-11 shrink-0 bg-[hsl(var(--chat-outgoing))] text-[hsl(var(--chat-outgoing-foreground))] shadow-none hover:bg-[hsl(var(--chat-outgoing)/0.9)]">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              </Button>
            ) : (
              <button type="button" onClick={startRecording} disabled={blocked || uploadingMedia} aria-label="Record voice note" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[hsl(var(--chat-outgoing))] transition-colors hover:bg-[hsl(var(--chat-incoming))] disabled:opacity-40">
                <Mic className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </footer>

      {actionMessage && (
        <div role="dialog" aria-modal="true" aria-label="Message actions" className="fixed inset-0 z-[75] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] md:items-center" onClick={() => setActionMessage(null)}>
          <div ref={actionSheetRef} tabIndex={-1} className="w-full max-w-sm rounded-2xl bg-[hsl(var(--chat-header))] p-2 shadow-xl outline-none" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-1 h-1 w-9 rounded-full bg-muted-foreground/35 md:hidden" />
            <button type="button" onClick={() => startReply(actionMessage)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-[hsl(var(--chat-incoming))]">
              <Reply className="h-4 w-4" aria-hidden="true" /> Reply
            </button>
            {actionMessage.content && (
              <button type="button" onClick={() => copyMessage(actionMessage)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-[hsl(var(--chat-incoming))]">
                <Copy className="h-4 w-4" aria-hidden="true" /> Copy
              </button>
            )}
            {actionMessage.senderId !== viewerProfileId && (
              <button type="button" onClick={() => { setReportMessageId(actionMessage.id); setActionMessage(null); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-destructive hover:bg-destructive/10">
                <Flag className="h-4 w-4" aria-hidden="true" /> Report
              </button>
            )}
          </div>
        </div>
      )}

      <ReportDialog targetType="message" targetId={reportMessageId ?? ""} label="Report message" open={Boolean(reportMessageId)} onOpenChange={(open) => { if (!open) setReportMessageId(null); }} hideTrigger />
    </section>
  );
}
