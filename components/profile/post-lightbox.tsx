"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { PostCard } from "@/components/posts/post-card";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { PostView } from "@/lib/posts";

export function PostLightbox({
  posts,
  initialPostId,
  onClose,
}: {
  posts: PostView[];
  initialPostId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialItemRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, dialogRef);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    initialItemRef.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post"
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background/95 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="mx-auto flex w-full max-w-xl flex-1 flex-col p-3 focus:outline-none sm:p-6"
      >
        <div className="sticky top-0 z-10 mb-2 flex justify-end bg-background/95 py-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <div
              key={post.id}
              ref={post.id === initialPostId ? initialItemRef : undefined}
            >
              <PostCard post={post} showAuthor={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
