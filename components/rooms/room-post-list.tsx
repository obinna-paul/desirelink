"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/components/safety/report-dialog";
import { RoomPostComposer } from "@/components/rooms/room-post-composer";
import type { RoomPostData } from "@/lib/rooms";

export function RoomPostList({
  roomId,
  initialPosts,
  canPost,
  canModerate,
}: {
  roomId: string;
  initialPosts: RoomPostData[];
  canPost: boolean;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(postId: string) {
    if (!window.confirm("Delete this post?")) return;

    setDeletingId(postId);
    const res = await fetch(`/api/rooms/${roomId}/posts/${postId}`, { method: "DELETE" });
    setDeletingId(null);

    if (res.ok) {
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canPost && (
        <RoomPostComposer roomId={roomId} onCreated={(post) => setPosts((prev) => [post, ...prev])} />
      )}

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          No posts yet. Be the first to share something.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => {
            const initials = post.author.displayName.slice(0, 2).toUpperCase();
            return (
              <li key={post.id} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={post.author.avatarUrl} alt={post.author.displayName} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{post.author.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ReportDialog targetType="room_post" targetId={post.id} label="Report post" variant="icon" />
                    {canModerate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Delete post"
                        disabled={deletingId === post.id}
                        onClick={() => handleDelete(post.id)}
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{post.content}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
