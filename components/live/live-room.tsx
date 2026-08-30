"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectionState, Track } from "livekit-client";
import type { PresenceChannel } from "pusher-js";
import {
  ConnectionStateToast,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useConnectionState,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react";
import { Heart, Radio, SwitchCamera, Users, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GiftPicker, type SendGiftOutcome } from "@/components/hearts/gift-picker";
import { FloatingHeartsLayer } from "@/components/live/floating-hearts";
import { LiveOnboarding } from "@/components/live/live-onboarding";
import { SubscribeChip } from "@/components/live/subscribe-chip";
import { getPusherClient } from "@/lib/pusher-client";
import { cn } from "@/lib/utils";
import type { PublicTierView } from "@/lib/tiers";
import {
  liveStreamChannelName,
  LIVE_CHAT_MESSAGE_EVENT,
  LIVE_GIFT_SENT_EVENT,
  LIVE_REACTION_EVENT,
  LIVE_STREAM_ENDED_EVENT,
} from "@/lib/live-stream-channels";

type ChatMessage = {
  id: string;
  content: string;
  sender: { username: string; displayName: string; avatarUrl: string };
  createdAt: string;
};

type GiftEvent = { hearts: number; sender: { displayName: string; avatarUrl: string } };
type CelebrationGift = GiftEvent & { id: number };

const CONTROL_PILL =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors";

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground">
      <Radio className="h-2.5 w-2.5 motion-safe:animate-pulse" aria-hidden="true" />
      Live
    </span>
  );
}

function VideoGrid() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  return (
    <GridLayout tracks={tracks} style={{ height: "100%" }}>
      <ParticipantTile />
    </GridLayout>
  );
}

/** Mirrors ConnectionStateToast's visual message for screen reader users - one atomic status, not a per-tick live region. */
function ConnectionAnnouncer() {
  const state = useConnectionState();
  const label =
    state === ConnectionState.Connecting
      ? "Connecting to the live stream"
      : state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting
        ? "Reconnecting to the live stream"
        : state === ConnectionState.Disconnected
          ? "Disconnected from the live stream"
          : state === ConnectionState.Connected
            ? "Connected"
            : null;

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {label}
    </div>
  );
}

function HostControls({
  initialCameraEnabled,
  initialMicEnabled,
}: {
  initialCameraEnabled: boolean;
  initialMicEnabled: boolean;
}) {
  const { localParticipant } = useLocalParticipant();
  const [micOn, setMicOn] = useState(initialMicEnabled);
  const [camOn, setCamOn] = useState(initialCameraEnabled);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  async function flipCamera() {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    if (camOn) await localParticipant.setCameraEnabled(true, { facingMode: next });
  }

  return (
    <div className="flex items-center gap-2">
      <TrackToggle
        source={Track.Source.Microphone}
        initialState={initialMicEnabled}
        onChange={setMicOn}
        aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        className={cn(CONTROL_PILL, micOn ? "bg-white/15 hover:bg-white/25" : "bg-destructive")}
      />
      <TrackToggle
        source={Track.Source.Camera}
        initialState={initialCameraEnabled}
        onChange={setCamOn}
        aria-label={camOn ? "Turn camera off" : "Turn camera on"}
        className={cn(CONTROL_PILL, camOn ? "bg-white/15 hover:bg-white/25" : "bg-destructive")}
      />
      <button
        type="button"
        onClick={flipCamera}
        aria-label="Flip camera"
        disabled={!camOn}
        className={cn(CONTROL_PILL, "bg-white/15 hover:bg-white/25 disabled:opacity-40")}
      >
        <SwitchCamera className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

function ChatBubble({ message, dense = false }: { message: ChatMessage; dense?: boolean }) {
  return (
    <div className={cn("flex items-start gap-2", dense && "drop-shadow")}>
      {!dense && (
        <Avatar className="h-7 w-7 shrink-0 border border-white/20">
          <AvatarImage src={message.sender.avatarUrl} alt="" />
          <AvatarFallback className="text-[10px]">{message.sender.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <p className={cn("min-w-0 break-words", dense ? "text-sm" : "text-sm leading-snug")}>
        <span className="font-semibold">{message.sender.displayName}</span>{" "}
        <span className={dense ? "" : "text-white/90"}>{message.content}</span>
      </p>
    </div>
  );
}

export function LiveRoom({
  streamId,
  token,
  livekitUrl,
  isHost,
  title,
  startedAt,
  initialHeartsTotal,
  provider,
  viewerHeartsBalance,
  initialCameraEnabled = true,
  initialMicEnabled = true,
  tiers = [],
}: {
  streamId: string;
  token: string;
  livekitUrl: string;
  isHost: boolean;
  title: string;
  startedAt: string;
  initialHeartsTotal: number;
  provider: { id: string; username: string; displayName: string; avatarUrl: string };
  viewerHeartsBalance: number;
  initialCameraEnabled?: boolean;
  initialMicEnabled?: boolean;
  tiers?: PublicTierView[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [peakViewers, setPeakViewers] = useState(0);
  const [heartsTotal, setHeartsTotal] = useState(initialHeartsTotal);
  const [giftQueue, setGiftQueue] = useState<CelebrationGift[]>([]);
  const [activeCelebration, setActiveCelebration] = useState<CelebrationGift | null>(null);
  const [remoteReactionTick, setRemoteReactionTick] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  );
  const [ended, setEnded] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const giftIdRef = useRef(0);

  useEffect(() => {
    tickerRef.current?.scrollTo({ top: tickerRef.current.scrollHeight });
    sidebarScrollRef.current?.scrollTo({ top: sidebarScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (viewerCount !== null) setPeakViewers((peak) => Math.max(peak, viewerCount));
  }, [viewerCount]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    if (activeCelebration || giftQueue.length === 0) return;
    const [next, ...rest] = giftQueue;
    setActiveCelebration(next);
    setGiftQueue(rest);
    const timeout = setTimeout(() => setActiveCelebration(null), 3200);
    return () => clearTimeout(timeout);
  }, [giftQueue, activeCelebration]);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channelName = liveStreamChannelName(streamId);
    const channel = client.subscribe(channelName) as PresenceChannel;

    channel.bind("pusher:subscription_succeeded", () => setViewerCount(channel.members.count));
    channel.bind("pusher:member_added", () => setViewerCount(channel.members.count));
    channel.bind("pusher:member_removed", () => setViewerCount(channel.members.count));

    function onChatMessage(message: ChatMessage) {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    }
    function onGift(gift: GiftEvent) {
      setHeartsTotal((total) => total + gift.hearts);
      setGiftQueue((prev) => [...prev, { ...gift, id: giftIdRef.current++ }]);
    }
    function onReaction() {
      setRemoteReactionTick((tick) => tick + 1);
    }
    function onEnded() {
      setEnded(true);
    }

    channel.bind(LIVE_CHAT_MESSAGE_EVENT, onChatMessage);
    channel.bind(LIVE_GIFT_SENT_EVENT, onGift);
    channel.bind(LIVE_REACTION_EVENT, onReaction);
    channel.bind(LIVE_STREAM_ENDED_EVENT, onEnded);

    return () => {
      channel.unbind(LIVE_CHAT_MESSAGE_EVENT, onChatMessage);
      channel.unbind(LIVE_GIFT_SENT_EVENT, onGift);
      channel.unbind(LIVE_REACTION_EVENT, onReaction);
      channel.unbind(LIVE_STREAM_ENDED_EVENT, onEnded);
      client.unsubscribe(channelName);
    };
  }, [streamId]);

  useEffect(() => {
    if (!confirmEnd) return;
    const timeout = setTimeout(() => setConfirmEnd(false), 3000);
    return () => clearTimeout(timeout);
  }, [confirmEnd]);

  async function sendChat(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    const body = content;
    setContent("");
    await fetch(`/api/live/${streamId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: body }),
    });
  }

  async function sendGift(hearts: number): Promise<SendGiftOutcome> {
    const res = await fetch(`/api/live/${streamId}/gift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearts }),
    });
    const responseBody = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: responseBody?.error ?? "Couldn't send that gift." };
    }
    return { ok: true, heartsBalance: responseBody.heartsBalance };
  }

  function sendReaction() {
    void fetch(`/api/live/${streamId}/react`, { method: "POST" });
  }

  function handleEndClick() {
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    setConfirmEnd(false);
    void (async () => {
      await fetch(`/api/live/${streamId}/end`, { method: "POST" });
      router.push("/");
    })();
  }

  const composer = (
    <form onSubmit={sendChat} className="flex gap-2">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Send a message…"
        maxLength={300}
        className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none lg:border-border lg:bg-secondary lg:text-foreground lg:placeholder:text-muted-foreground"
      />
      <Button type="submit" size="sm" disabled={!content.trim()}>
        Send
      </Button>
    </form>
  );

  if (ended) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black text-white">
        <p className="text-lg font-semibold">This stream has ended.</p>
        <Button type="button" onClick={() => router.push("/")}>
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div
      data-lk-theme="default"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white lg:static lg:inset-auto lg:z-auto lg:mx-auto lg:my-4 lg:h-[calc(100vh-7rem)] lg:max-w-6xl lg:flex-row lg:gap-4 lg:rounded-2xl lg:border lg:border-border/60 lg:bg-card lg:p-4"
    >
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={token}
        connect
        video={isHost && initialCameraEnabled}
        audio={isHost && initialMicEnabled}
        onDisconnected={() => router.push("/")}
        className="flex flex-1 flex-col lg:flex-row lg:gap-4"
      >
        <div
          className={cn(
            "relative flex-1 overflow-hidden lg:flex-[2] lg:rounded-xl",
            "[&_.lk-toast]:!top-[calc(env(safe-area-inset-top)+4.5rem)] lg:[&_.lk-toast]:!top-16"
          )}
        >
          <VideoGrid />
          <RoomAudioRenderer />
          <ConnectionStateToast />
          <ConnectionAnnouncer />

          {!isHost && <FloatingHeartsLayer onDoubleTap={sendReaction} remoteReactionTick={remoteReactionTick} />}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pt-3">
            <div className="flex min-w-0 items-start gap-2">
              <Avatar className="h-9 w-9 shrink-0 border border-white/30">
                <AvatarImage src={provider.avatarUrl} alt="" />
                <AvatarFallback>{provider.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold">{provider.displayName}</p>
                  <LiveBadge />
                </div>
                <p className="truncate text-xs text-white/70">{title}</p>
                {!isHost && (
                  <div className="pointer-events-auto mt-1">
                    <SubscribeChip providerId={provider.id} providerUsername={provider.username} tiers={tiers} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="flex items-center gap-2 rounded-full bg-white/15 px-2 py-1 text-xs tabular-nums"
                aria-label={`${viewerCount ?? 0} watching now, peak ${peakViewers}`}
              >
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  {viewerCount ?? "—"}
                </span>
                <span className="text-white/50" aria-hidden="true">
                  ·
                </span>
                <span aria-hidden="true">{formatElapsed(elapsedSeconds)}</span>
              </span>
              {isHost ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleEndClick}
                  className="pointer-events-auto"
                >
                  {confirmEnd ? "Tap to confirm" : "End"}
                </Button>
              ) : (
                <button
                  type="button"
                  aria-label="Leave stream"
                  onClick={() => router.push("/")}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Leave
                </button>
              )}
            </div>
          </div>

          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {activeCelebration &&
              `${activeCelebration.sender.displayName} sent ${activeCelebration.hearts} hearts`}
          </div>

          {activeCelebration && (
            <div
              key={activeCelebration.id}
              className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center px-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300"
            >
              <div className="flex items-center gap-3 rounded-2xl bg-black/70 px-4 py-3 shadow-lg backdrop-blur">
                <Avatar className="h-10 w-10 border-2 border-neon-pink">
                  <AvatarImage src={activeCelebration.sender.avatarUrl} alt="" />
                  <AvatarFallback>{activeCelebration.sender.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{activeCelebration.sender.displayName}</p>
                  <p className="flex items-center gap-1 text-lg font-bold text-neon-pink">
                    <Heart className="h-5 w-5" aria-hidden="true" fill="currentColor" /> {activeCelebration.hearts}
                  </p>
                </div>
              </div>
            </div>
          )}

          {heartsTotal > 0 && (
            <div className="pointer-events-none absolute bottom-24 right-3 flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs tabular-nums lg:bottom-3">
              <Heart className="h-3.5 w-3.5 text-neon-pink" aria-hidden="true" fill="currentColor" />
              {heartsTotal.toLocaleString()}
            </div>
          )}

          {/* Mobile-only: chat fades over the video like a live ticker. Sits higher in landscape to clear the floating footer below. */}
          <div
            ref={tickerRef}
            className="pointer-events-none absolute inset-x-0 bottom-0 flex max-h-40 flex-col gap-1 overflow-y-auto p-3 text-sm [mask-image:linear-gradient(to_top,black_60%,transparent)] landscape:bottom-24 landscape:max-h-24 lg:hidden"
          >
            {messages.slice(-30).map((message) => (
              <ChatBubble key={message.id} message={message} dense />
            ))}
          </div>

          {!isHost && <LiveOnboarding />}
        </div>

        {/* Mobile-only footer: controls, gifting, and the composer, stacked under the video in portrait. In landscape there's little vertical room, so it floats over the video instead of squeezing it. */}
        <div className="flex flex-col gap-2 border-t border-white/10 bg-black/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 landscape:absolute landscape:inset-x-0 landscape:bottom-0 landscape:border-t-0 landscape:bg-gradient-to-t landscape:from-black/95 landscape:via-black/80 landscape:to-transparent landscape:pt-8 lg:hidden">
          {isHost && (
            <HostControls initialCameraEnabled={initialCameraEnabled} initialMicEnabled={initialMicEnabled} />
          )}
          {!isHost && <GiftPicker initialBalance={viewerHeartsBalance} onSend={sendGift} theme="dark" />}
          {composer}
        </div>

        {/* Desktop-only: a persistent side panel — chat history, gifting, and controls all stay visible next to the video. */}
        <div className="hidden lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-border/60 lg:bg-background lg:text-foreground">
          <div className="border-b border-border/60 px-3 py-2.5">
            <p className="text-sm font-semibold">Live chat</p>
          </div>
          <div ref={sidebarScrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Messages will show up here.</p>
            ) : (
              messages.map((message) => <ChatBubble key={message.id} message={message} />)
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-border/60 p-3">
            {isHost && (
              <HostControls initialCameraEnabled={initialCameraEnabled} initialMicEnabled={initialMicEnabled} />
            )}
            {!isHost && <GiftPicker initialBalance={viewerHeartsBalance} onSend={sendGift} theme="light" />}
            {composer}
          </div>
        </div>
      </LiveKitRoom>
    </div>
  );
}
