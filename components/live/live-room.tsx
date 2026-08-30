"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Track } from "livekit-client";
import type { PresenceChannel } from "pusher-js";
import {
  ConnectionStateToast,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react";
import { Heart, SwitchCamera, Users, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GiftPicker, type SendGiftOutcome } from "@/components/hearts/gift-picker";
import { getPusherClient } from "@/lib/pusher-client";
import { cn } from "@/lib/utils";
import {
  liveStreamChannelName,
  LIVE_CHAT_MESSAGE_EVENT,
  LIVE_GIFT_SENT_EVENT,
  LIVE_STREAM_ENDED_EVENT,
} from "@/lib/live-stream-channels";

type ChatMessage = {
  id: string;
  content: string;
  sender: { username: string; displayName: string; avatarUrl: string };
  createdAt: string;
};

type GiftEvent = { hearts: number; sender: { displayName: string; avatarUrl: string } };

const CONTROL_PILL =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors";

function VideoGrid() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  return (
    <GridLayout tracks={tracks} style={{ height: "100%" }}>
      <ParticipantTile />
    </GridLayout>
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

export function LiveRoom({
  streamId,
  token,
  livekitUrl,
  isHost,
  title,
  provider,
  viewerHeartsBalance,
  initialCameraEnabled = true,
  initialMicEnabled = true,
}: {
  streamId: string;
  token: string;
  livekitUrl: string;
  isHost: boolean;
  title: string;
  provider: { username: string; displayName: string; avatarUrl: string };
  viewerHeartsBalance: number;
  initialCameraEnabled?: boolean;
  initialMicEnabled?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [recentGift, setRecentGift] = useState<GiftEvent | null>(null);
  const [ended, setEnded] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

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
      setRecentGift(gift);
      setTimeout(() => setRecentGift((current) => (current === gift ? null : current)), 4000);
    }
    function onEnded() {
      setEnded(true);
    }

    channel.bind(LIVE_CHAT_MESSAGE_EVENT, onChatMessage);
    channel.bind(LIVE_GIFT_SENT_EVENT, onGift);
    channel.bind(LIVE_STREAM_ENDED_EVENT, onEnded);

    return () => {
      channel.unbind(LIVE_CHAT_MESSAGE_EVENT, onChatMessage);
      channel.unbind(LIVE_GIFT_SENT_EVENT, onGift);
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
    <div data-lk-theme="default" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={token}
        connect
        video={isHost && initialCameraEnabled}
        audio={isHost && initialMicEnabled}
        onDisconnected={() => router.push("/")}
        className="flex flex-1 flex-col"
      >
        <div className="relative flex-1 overflow-hidden">
          <VideoGrid />
          <RoomAudioRenderer />
          <ConnectionStateToast />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-9 w-9 shrink-0 border border-white/30">
                <AvatarImage src={provider.avatarUrl} alt="" />
                <AvatarFallback>{provider.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{provider.displayName}</p>
                <p className="truncate text-xs text-white/70">{title}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-xs">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {viewerCount ?? "—"}
              </span>
              {isHost ? (
                <Button type="button" size="sm" variant="destructive" onClick={handleEndClick}>
                  {confirmEnd ? "Tap to confirm" : "End"}
                </Button>
              ) : (
                <button
                  type="button"
                  aria-label="Leave stream"
                  onClick={() => router.push("/")}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Leave
                </button>
              )}
            </div>
          </div>

          {recentGift && (
            <div className="absolute bottom-24 left-3 flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm">
              <Heart className="h-4 w-4 text-neon-pink" aria-hidden="true" fill="currentColor" />
              <span>
                <span className="font-semibold">{recentGift.sender.displayName}</span> sent {recentGift.hearts} hearts
              </span>
            </div>
          )}

          <div
            ref={scrollRef}
            className="pointer-events-none absolute inset-x-0 bottom-0 flex max-h-40 flex-col gap-1 overflow-y-auto p-3 text-sm [mask-image:linear-gradient(to_top,black_60%,transparent)]"
          >
            {messages.slice(-30).map((message) => (
              <p key={message.id} className="drop-shadow">
                <span className="font-semibold">{message.sender.displayName}: </span>
                {message.content}
              </p>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 bg-black/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
          {isHost && (
            <HostControls initialCameraEnabled={initialCameraEnabled} initialMicEnabled={initialMicEnabled} />
          )}
          {!isHost && <GiftPicker initialBalance={viewerHeartsBalance} onSend={sendGift} theme="dark" />}
          <form onSubmit={sendChat} className="flex gap-2">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Send a message…"
              maxLength={300}
              className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none"
            />
            <Button type="submit" size="sm" disabled={!content.trim()}>
              Send
            </Button>
          </form>
        </div>
      </LiveKitRoom>
    </div>
  );
}
