import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { normalizeHashtag } from "@/lib/hashtags";
import { prisma } from "@/lib/prisma";

const SUGGESTION_LIMIT = 8;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = normalizeHashtag(searchParams.get("q") ?? "").slice(0, 50);
  const visiblePost = {
    isArchived: false,
    isSubscriberOnly: false,
    author: { isIncognito: false, isSuspended: false },
  } as const;

  const hashtags = await prisma.hashtag.findMany({
    where: {
      tag: query ? { startsWith: query } : undefined,
      posts: { some: { post: visiblePost } },
    },
    orderBy: [{ posts: { _count: "desc" } }, { tag: "asc" }],
    take: SUGGESTION_LIMIT,
    select: {
      tag: true,
      _count: { select: { posts: { where: { post: visiblePost } } } },
    },
  });

  return NextResponse.json(
    {
      suggestions: hashtags.map((hashtag) => ({
        tag: hashtag.tag,
        postCount: hashtag._count.posts,
      })),
    },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
