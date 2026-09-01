"use client";

import { useEffect, useRef, useState } from "react";

import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";
import { CommentComposer, CommentsList, usePostComments } from "@/components/posts/post-comments-shared";

const CLOSE_ANIMATION_MS = 240;
const DRAG_DISMISS_THRESHOLD = 110;

/** Mobile bottom-sheet chrome for comments. On md+ viewports PostActions opens PostDetailModal instead. */
export function CommentsSheet({
  open,
  onClose,
  postId,
  authorUsername,
  onCommentCountChange,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  authorUsername: string;
  onCommentCountChange: (count: number) => void;
}) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragState = useRef<{ startY: number; dragging: boolean } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, sheetRef);

  const { comments, loadingInitial, loadingMore, loadError, sentinelRef, prependComment } = usePostComments(open, postId);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    if (rendered) {
      setVisible(false);
      const timeout = setTimeout(() => setRendered(false), CLOSE_ANIMATION_MS);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!rendered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rendered]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function handleDragStart(event: React.PointerEvent) {
    dragState.current = { startY: event.clientY, dragging: true };
  }

  function handleDragMove(event: React.PointerEvent) {
    if (!dragState.current?.dragging) return;
    const delta = event.clientY - dragState.current.startY;
    setDragOffset(Math.max(0, delta));
  }

  function handleDragEnd() {
    if (!dragState.current) return;
    dragState.current.dragging = false;
    if (dragOffset > DRAG_DISMISS_THRESHOLD) {
      onClose();
    }
    setDragOffset(0);
  }

  function handleReplyPosted(newCount?: number) {
    if (typeof newCount === "number") onCommentCountChange(newCount);
  }

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-50" aria-hidden={!open}>
      <div
        className={cn(
          "absolute inset-0 bg-foreground/45 backdrop-blur-[1px] transition-opacity motion-reduce:transition-none",
          visible ? "opacity-100 duration-300" : "opacity-0 duration-200"
        )}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[86vh] flex-col overflow-hidden rounded-t-[22px] bg-card shadow-lift transition-transform motion-reduce:transition-none",
          visible ? "translate-y-0 duration-300 ease-out" : "translate-y-full duration-200 ease-in"
        )}
        style={dragState.current?.dragging ? { transform: `translateY(${dragOffset}px)`, transition: "none" } : undefined}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-2 pt-2.5 active:cursor-grabbing"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <span className="h-1 w-9 rounded-full bg-border" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center justify-center border-b border-border px-4 pb-3">
          <p className="font-heading text-[15px] italic font-semibold">Comments</p>
        </div>

        <div data-comments-scroll className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <CommentsList
            postId={postId}
            authorUsername={authorUsername}
            comments={comments}
            loadingInitial={loadingInitial}
            loadingMore={loadingMore}
            loadError={loadError}
            sentinelRef={sentinelRef}
            onReplyPosted={handleReplyPosted}
          />
        </div>

        <CommentComposer
          postId={postId}
          onCommentPosted={(comment, count) => {
            prependComment(comment);
            if (typeof count === "number") onCommentCountChange(count);
          }}
        />
      </div>
    </div>
  );
}
