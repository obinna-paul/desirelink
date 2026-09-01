"use client";

import { useRef, useState } from "react";
import { Ellipsis, Reply } from "lucide-react";

import { MessageMedia } from "@/components/messages/message-media";
import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/lib/message-types";

const SWIPE_REPLY_THRESHOLD = 48;
const MAX_DRAG_DISTANCE = 72;
const LONG_PRESS_MS = 450;

export function MessageBubble({
  message,
  viewerProfileId,
  counterpartName,
  isMine,
  groupStart,
  groupEnd,
  dateLabel,
  showSeen,
  onReply,
  onActions,
}: {
  message: ConversationMessage;
  viewerProfileId: string;
  counterpartName: string;
  isMine: boolean;
  groupStart: boolean;
  groupEnd: boolean;
  dateLabel: string | null;
  showSeen: boolean;
  onReply: (message: ConversationMessage) => void;
  onActions: (message: ConversationMessage) => void;
}) {
  const [dragX, setDragX] = useState(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    longPressTimer.current = setTimeout(() => {
      setDragX(0);
      onActions(message);
      pointerStart.current = null;
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointerStart.current || event.pointerType !== "touch") return;
    const deltaX = event.clientX - pointerStart.current.x;
    const deltaY = event.clientY - pointerStart.current.y;
    if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
      clearLongPress();
      setDragX(0);
      return;
    }
    if (deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY)) {
      clearLongPress();
      setDragX(Math.min(deltaX, MAX_DRAG_DISTANCE));
    }
  }

  function finishPointer() {
    clearLongPress();
    if (dragX >= SWIPE_REPLY_THRESHOLD) onReply(message);
    setDragX(0);
    pointerStart.current = null;
  }

  return (
    <li>
      {dateLabel && (
        <div className="my-5 flex items-center justify-center" role="separator">
          <span className="rounded-full bg-[hsl(var(--chat-date))] px-3 py-1 text-[11px] font-medium text-muted-foreground">
            {dateLabel}
          </span>
        </div>
      )}
      <div
        className={cn("group relative flex min-w-0", isMine ? "justify-end" : "justify-start")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onContextMenu={(event) => {
          event.preventDefault();
          onActions(message);
        }}
        style={{ touchAction: "pan-y" }}
      >
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[hsl(var(--chat-outgoing))] transition-opacity md:hidden",
            dragX > 8 ? "opacity-100" : "opacity-0",
            isMine ? "right-[calc(78%+0.5rem)]" : "left-1"
          )}
          aria-hidden="true"
        >
          <Reply className="h-4 w-4" />
        </span>

        <div
          className={cn(
            "flex max-w-[82%] items-center gap-1.5 transition-transform duration-150 ease-out md:max-w-[68%]",
            isMine && "flex-row-reverse"
          )}
          style={{ transform: `translateX(${dragX}px)` }}
        >
          <div className={cn("flex min-w-0 flex-col", isMine ? "items-end" : "items-start")}>
            <div
              className={cn(
                "min-w-0 text-[15px] leading-[1.42]",
                message.mediaType ? "p-1.5" : "px-3.5 py-2.5",
                isMine
                  ? "bg-[hsl(var(--chat-outgoing))] text-[hsl(var(--chat-outgoing-foreground))]"
                  : "bg-[hsl(var(--chat-incoming))] text-foreground",
                isMine
                  ? cn("rounded-[15px]", !groupStart && "rounded-tr-[5px]", !groupEnd && "rounded-br-[5px]", groupEnd && "rounded-br-[6px]")
                  : cn("rounded-[15px]", !groupStart && "rounded-tl-[5px]", !groupEnd && "rounded-bl-[5px]", groupEnd && "rounded-bl-[6px]")
              )}
            >
              {message.replyTo && (
                <div
                  className={cn(
                    "mb-2 border-l-2 px-2 pt-1 text-xs leading-4",
                    isMine
                      ? "border-[hsl(var(--chat-outgoing-foreground)/0.5)] text-[hsl(var(--chat-outgoing-foreground)/0.72)]"
                      : "border-[hsl(var(--chat-outgoing)/0.55)] text-muted-foreground"
                  )}
                >
                  <p className="font-semibold">
                    {message.replyTo.senderId === viewerProfileId ? "You" : counterpartName}
                  </p>
                  <p className="line-clamp-2">{message.replyTo.content || (message.replyTo.mediaType === "audio" ? "Voice note" : message.replyTo.mediaType === "video" ? "Video" : "Photo")}</p>
                </div>
              )}
              <MessageMedia message={message} isMine={isMine} />
              {message.content && <p className={cn("whitespace-pre-wrap break-words", message.mediaType && "px-2 pb-1 pt-2")}>{message.content}</p>}
            </div>
            {groupEnd && (
              <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
                <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                {showSeen && <span>Seen</span>}
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Message actions"
            title="Message actions"
            onClick={() => onActions(message)}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:flex group-hover:opacity-100 group-focus-within:flex group-focus-within:opacity-100 md:flex"
          >
            <Ellipsis className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}
