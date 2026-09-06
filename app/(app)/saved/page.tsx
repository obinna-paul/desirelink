import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PostList } from "@/components/posts/post-list";
import { getPostsByIds } from "@/lib/posts";
import { getSavedPostIds } from "@/lib/saved-posts";

export default async function SavedPostsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!viewerProfile) {
    redirect("/login");
  }

  const savedPostIds = await getSavedPostIds(viewerProfile.id);
  const posts = await getPostsByIds(savedPostIds, viewerProfile.id);
  const postById = new Map(posts.map((post) => [post.id, post]));
  const orderedPosts = savedPostIds.flatMap((id) => {
    const post = postById.get(id);
    return post ? [post] : [];
  });

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="px-0.5">
        <h1 className="text-lg font-semibold text-foreground">Saved posts</h1>
      </div>

      <PostList posts={orderedPosts} emptyMessage="Posts you save will show up here." surface="saved" />
    </div>
  );
}
