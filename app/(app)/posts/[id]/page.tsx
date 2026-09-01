import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPostByIdForViewer } from "@/lib/posts";
import { PostCard } from "@/components/posts/post-card";
import { absoluteUrl, SITE_NAME } from "@/lib/site-config";

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

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const viewerProfileId = await getViewerProfileId();
  const post = await getPostByIdForViewer(params.id, viewerProfileId);
  if (!post) return { title: "Post not found" };

  const title = `${post.author.displayName} on ${SITE_NAME}`;
  const description = post.locked
    ? `Subscriber-exclusive post from ${post.author.displayName}.`
    : post.content?.slice(0, 160) || `A post by ${post.author.displayName} on ${SITE_NAME}.`;
  const image = !post.locked && post.mediaItems[0]?.type === "image" ? post.mediaItems[0].url : undefined;
  const url = absoluteUrl(`/posts/${post.id}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const viewerProfileId = await getViewerProfileId();
  const post = await getPostByIdForViewer(params.id, viewerProfileId);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    url: absoluteUrl(`/posts/${post.id}`),
    datePublished: post.createdAt,
    author: {
      "@type": "Person",
      name: post.author.displayName,
      url: absoluteUrl(`/profile/${post.author.username}`),
    },
    ...(post.locked ? {} : { articleBody: post.content ?? undefined }),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PostCard post={post} />
    </div>
  );
}
