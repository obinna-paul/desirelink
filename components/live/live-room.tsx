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
import { Gift, Heart, ListChecks, MessageCircle, Radio, Send, SwitchCamera, Users, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { SendGiftOutcome } from "@/components/hearts/gift-picker";
import { FloatingHeartsLayer } from "@/components/live/floating-hearts";
import {
  CreatorRequestQueue,
  LiveGiftTray,
  ViewerRequestSheet,
  type LiveRequestOptionView,
  type LiveRequestView,
} from "@/components/live/live-action-sheets";
import { LiveOnboarding } from "@/components/live/live-onboarding";
import { SubscribeChip } from "@/components/live/subscribe-chip";
import { getPusherClient } from "@/lib/pusher-client";
import { getUserChannelName } from "@/lib/message-channels";
import { cn } from "@/lib/utils";
import type { PublicTierView } from "@/lib/tiers";
import {
  liveStreamChannelName,
  LIVE_CHAT_MESSAGE_EVENT,
  LIVE_GIFT_SENT_EVENT,
  LIVE_REACTION_EVENT,
  LIVE_REQUEST_CREATED_EVENT,
  LIVE_REQUEST_COMPLETED_EVENT,
  LIVE_REQUEST_UPDATED_EVENT,
  LIVE_STREAM_ENDED_EVENT,
  liveHostChannelName,
} from "@/lib/live-stream-channels";

type ChatMessage = {
  id: string;
  content: string;
  sender: { username: string; displayName: string; avatarUrl: string };
  createdAt: string;
};

/** A join notice or gift log line, interleaved with real chat so the feed reads as one timeline. */
type SystemEntry = { kind: "system"; id: string; text: string };
type ChatEntry = ({ kind: "chat" } & ChatMessage) | SystemEntry;

type GiftEvent = { hearts: number; sender: { displayName: string; avatarUrl: string } };
type CelebrationGift = GiftEvent & { id: number };

type PresenceMemberInfo = { username?: string; displayName?: string; avatarUrl?: string };

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

function ChatBubble({ entry, dense = false }: { entry: ChatEntry; dense?: boolean }) {
  if (entry.kind === "system") {
    return (
      <p className={cn("text-center text-xs italic", dense ? "text-white/60" : "text-muted-foreground")}>
        {entry.text}
      </p>
    );
  }

  return (
    <div className={cn("flex items-start gap-2", dense && "w-fit max-w-[88%] rounded-lg bg-black/40 px-2.5 py-1.5 backdrop-blur-sm")}>
      {!dense && (
        <Avatar className="h-7 w-7 shrink-0 border border-white/20">
          <AvatarImage src={entry.sender.avatarUrl} alt="" />
          <AvatarFallback className="text-[10px]">{entry.sender.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <p className={cn("min-w-0 break-words", dense ? "text-sm" : "text-sm leading-snug")}>
        <span className="font-semibold">{entry.sender.displayName}</span>{" "}
        <span className={dense ? "" : "text-white/90"}>{entry.content}</span>
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
  viewerProfileId,
  heartGoal,
  requestOptions,
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
  viewerProfileId: string;
  heartGoal: number | null;
  requestOptions: LiveRequestOptionView[];
  initialCameraEnabled?: boolean;
  initialMicEnabled?: boolean;
  tiers?: PublicTierView[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [content, setContent] = useState("");
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [peakViewers, setPeakViewers] = useState(0);
  const [heartsTotal, setHeartsTotal] = useState(initialHeartsTotal);
  const [heartsBalance, setHeartsBalance] = useState(viewerHeartsBalance);
  const [requests, setRequests] = useState<LiveRequestView[]>([]);
  const [giftOpen, setGiftOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [hostQueueOpen, setHostQueueOpen] = useState(false);
  const [chatHidden, setChatHidden] = useState(false);
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
  const systemIdRef = useRef(0);

  function upsertRequest(request: LiveRequestView) {
    setRequests((current) => {
      const exists = current.some((item) => item.id === request.id);
      return exists ? current.map((item) => (item.id === request.id ? { ...item, ...request } : item)) : [request, ...current];
    });
  }

  function pushSystemEntry(text: string) {
    setMessages((prev) => [...prev, { kind: "system", id: `system-${systemIdRef.current++}`, text }]);
  }

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

    const audienceCount = () => Math.max(0, channel.members.count - 1);
    channel.bind("pusher:subscription_succeeded", () => setViewerCount(audienceCount()));
    channel.bind("pusher:member_added", (member: { info?: PresenceMemberInfo }) => {
      setViewerCount(audienceCount());
      // Host-only: a per-viewer "joined" line would be noise in every viewer's own feed on any stream with real traffic.
      if (isHost && member.info?.displayName) pushSystemEntry(`${member.info.displayName} joined`);
    });
    channel.bind("pusher:member_removed", () => setViewerCount(audienceCount()));

    function onChatMessage(message: ChatMessage) {
      setMessages((prev) =>
        prev.some((m) => m.kind === "chat" && m.id === message.id) ? prev : [...prev, { kind: "chat", ...message }]
      );
    }
    function onGift(gift: GiftEvent) {
      setHeartsTotal((total) => total + gift.hearts);
      setGiftQueue((prev) => [...prev, { ...gift, id: giftIdRef.current++ }]);
      pushSystemEntry(`${gift.sender.displayName} sent ${gift.hearts} ${gift.hearts === 1 ? "heart" : "hearts"}`);
    }
    function onReaction() {
      setRemoteReactionTick((tick) => tick + 1);
    }
    function onEnded() {
      setEnded(true);
    }
    function onRequestCompleted(event: { label: string; hearts: number; requester?: { displayName?: string } }) {
      setHeartsTotal((total) => total + event.hearts);
      if (event.requester?.displayName) pushSystemEntry(`${event.requester.displayName}'s request was completed`);
    }

    channel.bind(LIVE_CHAT_MESSAGE_EVENT, onChatMessage);
    channel.bind(LIVE_GIFT_SENT_EVENT, onGift);
    channel.bind(LIVE_REACTION_EVENT, onReaction);
    channel.bind(LIVE_STREAM_ENDED_EVENT, onEnded);
    channel.bind(LIVE_REQUEST_COMPLETED_EVENT, onRequestCompleted);

    return () => {
      channel.unbind(LIVE_CHAT_MESSAGE_EVENT, onChatMessage);
      channel.unbind(LIVE_GIFT_SENT_EVENT, onGift);
      channel.unbind(LIVE_REACTION_EVENT, onReaction);
      channel.unbind(LIVE_STREAM_ENDED_EVENT, onEnded);
      channel.unbind(LIVE_REQUEST_COMPLETED_EVENT, onRequestCompleted);
      client.unsubscribe(channelName);
    };
  }, [streamId, isHost]);

  useEffect(() => {
    void fetch(`/api/live/${streamId}/requests`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.requests) setRequests(body.requests);
      });
  }, [streamId]);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;
    const channelName = isHost ? liveHostChannelName(streamId) : getUserChannelName(viewerProfileId);
    const channel = client.subscribe(channelName);
    const onRequest = (request: LiveRequestView) => upsertRequest(request);
    channel.bind(LIVE_REQUEST_CREATED_EVENT, onRequest);
    channel.bind(LIVE_REQUEST_UPDATED_EVENT, onRequest);
    return () => {
      channel.unbind(LIVE_REQUEST_CREATED_EVENT, onRequest);
      channel.unbind(LIVE_REQUEST_UPDATED_EVENT, onRequest);
      client.unsubscribe(channelName);
    };
  }, [isHost, streamId, viewerProfileId]);

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
    setHeartsBalance(responseBody.heartsBalance);
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
      await fetch(`/api/live/${streamId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peakViewers }),
      });
      router.push("/");
    })();
  }

  const composer = (
    <form onSubmit={sendChat} className="flex min-w-0 flex-1 gap-2">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Send a message…"
        maxLength={300}
        className="min-h-11 min-w-0 flex-1 rounded-full border border-white/20 bg-black/[0.35] px-4 py-2 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none lg:border-border lg:bg-secondary lg:text-foreground lg:placeholder:text-muted-foreground"
      />
      <button type="submit" disabled={!content.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-white/[0.85] disabled:bg-white/10 disabled:text-white/30" aria-label="Send message">
        <Send className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );

  const activeViewerRequest = !isHost
    ? requests.find((request) => request.status === "accepted" || request.status === "pending")
    : null;
  const pendingRequestCount = requests.filter((request) => request.status === "pending").length;

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
    <div data-lk-theme="default" className="fixed inset-0 z-50 flex flex-col bg-black text-white lg:flex-row">
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={token}
        connect
        video={isHost && initialCameraEnabled}
        audio={isHost && initialMicEnabled}
        onDisconnected={() => router.push("/")}
        className="flex flex-1 flex-col lg:flex-row"
      >
        <div
          className={cn(
            "relative flex-1 overflow-hidden lg:flex-[2]",
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

          {heartGoal && (
            <div className="pointer-events-none absolute right-3 top-[calc(env(safe-area-inset-top)+4.6rem)] w-32 rounded-lg bg-black/45 px-2.5 py-2 backdrop-blur-md lg:right-5 lg:top-20">
              <div className="flex items-center justify-between text-[10px] font-medium text-white/65"><span>Heart goal</span><span className="tabular-nums">{Math.min(100, Math.round((heartsTotal / heartGoal) * 100))}%</span></div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-fuchsia-400 transition-[width]" style={{ width: `${Math.min(100, (heartsTotal / heartGoal) * 100)}%` }} /></div>
            </div>
          )}

          {activeViewerRequest && (
            <button type="button" onClick={() => setRequestOpen(true)} className="absolute left-3 top-[calc(env(safe-area-inset-top)+4.7rem)] z-10 flex min-h-10 max-w-[58%] items-center gap-2 rounded-lg bg-black/50 px-3 text-left text-xs text-white backdrop-blur-md lg:left-5 lg:top-20">
              {activeViewerRequest.status === "accepted" ? <Heart className="h-4 w-4 shrink-0 text-emerald-300" fill="currentColor" aria-hidden="true" /> : <ListChecks className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />}
              <span className="truncate">{activeViewerRequest.status === "accepted" ? "Accepted" : "Waiting"}: {activeViewerRequest.label}</span>
            </button>
          )}

          {/* Mobile-only: chat fades over the video like a live ticker. Sits higher in landscape to clear the floating footer below. */}
          {!chatHidden && <div
            ref={tickerRef}
            className="pointer-events-none absolute inset-x-0 bottom-24 flex max-h-48 flex-col items-start gap-1.5 overflow-hidden px-3 py-2 text-sm [mask-image:linear-gradient(to_top,black_72%,transparent)] landscape:max-h-28 lg:hidden"
          >
            {messages.slice(-8).map((entry) => (
              <ChatBubble key={entry.id} entry={entry} dense />
            ))}
          </div>}

          {!isHost && <LiveOnboarding />}
        </div>

        {/* Mobile-only footer: controls, gifting, and the composer, stacked under the video in portrait. In landscape there's little vertical room, so it floats over the video instead of squeezing it. */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-end gap-2 bg-gradient-to-t from-black via-black/75 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-8 lg:hidden">
          {isHost ? (
            <div className="flex w-full items-center justify-between gap-3">
              <HostControls initialCameraEnabled={initialCameraEnabled} initialMicEnabled={initialMicEnabled} />
              <button type="button" onClick={() => setHostQueueOpen(true)} className="relative flex h-11 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-black" aria-label="Open request queue">
                <ListChecks className="h-4 w-4" aria-hidden="true" /> Requests
                {pendingRequestCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-600 px-1 text-[10px] text-white">{pendingRequestCount}</span>}
              </button>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => setChatHidden((current) => !current)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur" aria-label={chatHidden ? "Show live chat" : "Hide live chat"} aria-pressed={chatHidden}>
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setGiftOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur" aria-label="Send a gift">
                <Gift className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setRequestOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur" aria-label="Make a request">
                <ListChecks className="h-5 w-5" aria-hidden="true" />
              </button>
              {composer}
            </>
          )}
        </div>

        {/* Desktop-only: a persistent side panel — chat history, gifting, and controls all stay visible next to the video. Flush against the viewport edge now that the room takes over the full screen. */}
        <div className="hidden lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:overflow-hidden lg:border-l lg:border-border/60 lg:bg-background lg:text-foreground">
          <div className="border-b border-border/60 px-3 py-2.5">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Live chat</p>{isHost && <button type="button" onClick={() => setHostQueueOpen(true)} className="relative flex h-9 items-center gap-2 rounded-lg px-2 text-xs font-medium hover:bg-secondary"><ListChecks className="h-4 w-4" aria-hidden="true" />Requests{pendingRequestCount > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{pendingRequestCount}</span>}</button>}</div>
          </div>
          <div ref={sidebarScrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Messages will show up here.</p>
            ) : (
              messages.map((entry) => <ChatBubble key={entry.id} entry={entry} />)
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-border/60 p-3">
            {isHost && (
              <HostControls initialCameraEnabled={initialCameraEnabled} initialMicEnabled={initialMicEnabled} />
            )}
            {!isHost && <div className="flex gap-2"><button type="button" onClick={() => setGiftOpen(true)} className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium"><Gift className="h-4 w-4" aria-hidden="true" />Gift</button><button type="button" onClick={() => setRequestOpen(true)} className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium"><ListChecks className="h-4 w-4" aria-hidden="true" />Request</button></div>}
            {composer}
          </div>
        </div>
      </LiveKitRoom>

      {!isHost && <LiveGiftTray open={giftOpen} onClose={() => setGiftOpen(false)} balance={heartsBalance} onSend={sendGift} />}
      {!isHost && <ViewerRequestSheet open={requestOpen} onClose={() => setRequestOpen(false)} streamId={streamId} options={requestOptions} balance={heartsBalance} requests={requests} onCreated={(request, spent) => { upsertRequest(request); setHeartsBalance((current) => Math.max(0, current - spent)); }} />}
      {isHost && <CreatorRequestQueue open={hostQueueOpen} onClose={() => setHostQueueOpen(false)} requests={requests} onUpdated={upsertRequest} />}
    </div>
  );
}
