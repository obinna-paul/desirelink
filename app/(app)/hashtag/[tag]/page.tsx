import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PostList } from "@/components/posts/post-list";
import { getPostsByHashtag } from "@/lib/posts";
import { normalizeHashtag } from "@/lib/hashtags";

export default async function HashtagPage({
  params,
}: {
  params: { tag: string };
}) {
  const session = await getServerSession(authOptions);

  const viewerProfile = session?.user?.id
    ? await prisma.profile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null;

  const tag = normalizeHashtag(params.tag);
  const posts = await getPostsByHashtag(tag, viewerProfile?.id ?? null);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="px-0.5">
        <h1 className="text-lg font-semibold text-foreground">#{tag}</h1>
        <p className="text-sm text-muted-foreground">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </p>
      </div>

      <PostList posts={posts} emptyMessage="No posts with this hashtag yet." surface="hashtag" />
    </div>
  );
}
