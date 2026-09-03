import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Lock } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getPostPreview } from "@/lib/admin/content";
import { LockedContentViewer } from "@/components/admin/locked-content-viewer";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminPostViewerPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "view_locked_content");
  if (!gate.ok) {
    notFound();
  }

  const post = await getPostPreview(params.id);
  if (!post) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/admin/accounts/${post.author.username}`}
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to @{post.author.username}
      </Link>

      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-foreground">Post by @{post.author.username}</h1>
        {post.isSubscriberOnly && (
          <Badge variant="outline" className="gap-1">
            <Lock className="h-3 w-3" aria-hidden="true" /> Premium
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Posted {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })} &middot; {post.viewCount} view
        {post.viewCount === 1 ? "" : "s"}
        {post.isArchived && " · archived"}
      </p>

      <LockedContentViewer postId={post.id} authorUsername={post.author.username} />
    </div>
  );
}
