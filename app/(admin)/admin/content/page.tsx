import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Heart, Lock, MessageCircle } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getRecentPremiumPosts } from "@/lib/admin/content";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default async function AdminContentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "view_locked_content");
  if (!gate.ok) {
    notFound();
  }

  const posts = await getRecentPremiumPosts(30);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Premium content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The most recent paywalled posts platform-wide, for quality control - spot-check what people are
          charging for and whether it holds up. Opening one still requires a reason, logged to the audit trail.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          No premium posts yet.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/admin/content/posts/${post.id}`}
                className="flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={post.author.avatarUrl} alt={post.author.displayName} />
                    <AvatarFallback className="text-xs">{initials(post.author.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{post.author.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>

                <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{post.viewCount.toLocaleString()} views</span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" aria-hidden="true" /> {post._count.reactions}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" aria-hidden="true" /> {post._count.comments}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
