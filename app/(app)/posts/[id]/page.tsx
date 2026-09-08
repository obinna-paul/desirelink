import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPostByIdForViewer } from "@/lib/posts";
import { PostCard } from "@/components/posts/post-card";
import { absoluteUrl, SITE_NAME } from "@/lib/site-config";
import { PRIVATE_ROBOTS, PUBLIC_ROBOTS, publicPageMetadata, seoDescription, serializeJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function getViewerProfileId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  return profile?.id ?? null;
}

async function getPostSearchState(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: {
      isArchived: true,
      isSubscriberOnly: true,
      updatedAt: true,
      author: {
        select: { isSuspended: true, isIncognito: true, showInSearch: true },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const viewerProfileId = await getViewerProfileId();
  const [post, searchState] = await Promise.all([
    getPostByIdForViewer(params.id, viewerProfileId),
    getPostSearchState(params.id),
  ]);
  if (!post) return { title: "Post not found" };

  const title = `Post by ${post.author.displayName} (@${post.author.username})`;
  const description = post.locked
    ? `Subscriber-exclusive post from ${post.author.displayName}.`
    : seoDescription(post.content, `See this post by ${post.author.displayName} on ${SITE_NAME}.`);
  const image = !post.locked && post.mediaItems[0]?.type === "image" ? post.mediaItems[0].url : undefined;
  const indexable = Boolean(
    searchState &&
      !searchState.isArchived &&
      !searchState.isSubscriberOnly &&
      !searchState.author.isSuspended &&
      !searchState.author.isIncognito &&
      searchState.author.showInSearch,
  );

  return {
    ...publicPageMetadata({
      title,
      description,
      path: `/posts/${post.id}`,
      image,
      type: "article",
    }),
    robots: indexable ? PUBLIC_ROBOTS : PRIVATE_ROBOTS,
  };
}

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { comments?: string };
}) {
  const viewerProfileId = await getViewerProfileId();
  const [post, searchState] = await Promise.all([
    getPostByIdForViewer(params.id, viewerProfileId),
    getPostSearchState(params.id),
  ]);
  if (!post) notFound();

  const indexable = Boolean(
    searchState &&
      !searchState.isArchived &&
      !searchState.isSubscriberOnly &&
      !searchState.author.isSuspended &&
      !searchState.author.isIncognito &&
      searchState.author.showInSearch,
  );
  const postUrl = absoluteUrl(`/posts/${post.id}`);
  const postTitle = `Post by ${post.author.displayName} (@${post.author.username})`;
  const postDescription = seoDescription(
    post.content,
    `See this post by ${post.author.displayName} on ${SITE_NAME}.`,
  );
  const images = post.mediaItems.filter((item) => item.type === "image").map((item) => item.url);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    "@id": `${postUrl}#posting`,
    url: postUrl,
    headline: postTitle,
    description: postDescription,
    datePublished: post.createdAt,
    dateModified: searchState?.updatedAt.toISOString(),
    mainEntityOfPage: postUrl,
    image: images.length > 0 ? images : undefined,
    author: {
      "@type": "Person",
      "@id": `${absoluteUrl(`/profile/${post.author.username}`)}#person`,
      name: post.author.displayName,
      alternateName: `@${post.author.username}`,
      url: absoluteUrl(`/profile/${post.author.username}`),
    },
    articleBody: post.content ?? undefined,
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post.counts.reactions,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.counts.comments,
      },
    ],
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {indexable && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      )}
      <PostCard
        post={post}
        surface="post_detail"
        openCommentsInitially={searchParams.comments === "1"}
      />
    </div>
  );
}
