"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";

import { PostCard } from "@/components/posts/post-card";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { PostView } from "@/lib/posts";

export function PostLightbox({
  posts,
  initialPostId,
  sectionLabel,
  onClose,
}: {
  posts: PostView[];
  initialPostId: string;
  sectionLabel: string;
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
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background"
    >
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-2 py-2.5 backdrop-blur-sm sm:px-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          {sectionLabel}
        </h2>
      </div>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 py-3 focus:outline-none sm:py-4"
      >
        {posts.map((post) => (
          <div
            key={post.id}
            ref={post.id === initialPostId ? initialItemRef : undefined}
            className={post.id === initialPostId ? "scroll-mt-16" : undefined}
          >
            <PostCard post={post} />
          </div>
        ))}
      </div>
    </div>
  );
}
