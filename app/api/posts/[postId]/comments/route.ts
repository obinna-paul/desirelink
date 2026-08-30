import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { flagContentIfNeeded } from "@/lib/moderation";
import { isActiveSubscriber } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/security/request";

const commentSchema = z.object({
  content: z.string().trim().min(1, "Comment can't be empty").max(1000, "Comments must be 1000 characters or fewer"),
  parentId: z.string().optional(),
});

function isMissingPostArchiveError(error: unknown): boolean {
  const target =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? String(error.meta?.table ?? error.meta?.column ?? "")
      : "";

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    (target.includes("Post.isArchived") || target.includes("isArchived"))
  );
}

function serializeComment(comment: {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; username: string; displayName: string; avatarUrl: string };
}) {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: comment.author,
    replies: [],
  };
}

type RawNode = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; username: string; displayName: string; avatarUrl: string };
  replies?: RawNode[];
};

function normalizeThread(node: RawNode): {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl: string };
  replies: ReturnType<typeof normalizeThread>[];
} {
  return {
    id: node.id,
    content: node.content,
    createdAt: node.createdAt.toISOString(),
    author: node.author,
    replies: (node.replies ?? []).map(normalizeThread),
  };
}

const AUTHOR_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } as const;
const PAGE_SIZE = 15;

export async function GET(req: Request, { params }: { params: { postId: string } }) {
  const session = await getServerSession(authOptions);
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");

  const viewerProfile = session?.user?.id
    ? await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    : null;

  let post: { id: string; authorId: string; isSubscriberOnly: boolean } | null;
  try {
    post = await prisma.post.findFirst({
      where: { id: params.postId, isArchived: false },
      select: { id: true, authorId: true, isSubscriberOnly: true },
    });
  } catch (error) {
    if (!isMissingPostArchiveError(error)) throw error;
    post = await prisma.post.findUnique({
      where: { id: params.postId },
      select: { id: true, authorId: true, isSubscriberOnly: true },
    });
  }
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (
    post.isSubscriberOnly &&
    post.authorId !== viewerProfile?.id &&
    !(viewerProfile && (await isActiveSubscriber(viewerProfile.id, post.authorId)))
  ) {
    return NextResponse.json({ comments: [], nextCursor: null });
  }

  const rows = await prisma.postComment.findMany({
    where: { postId: params.postId, parentId: null },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: AUTHOR_SELECT },
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: AUTHOR_SELECT },
          replies: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              content: true,
              createdAt: true,
              author: { select: AUTHOR_SELECT },
              replies: {
                orderBy: { createdAt: "asc" },
                select: { id: true, content: true, createdAt: true, author: { select: AUTHOR_SELECT } },
              },
            },
          },
        },
      },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const comments = page.map(normalizeThread);

  return NextResponse.json({
    comments,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}

export async function POST(req: Request, { params }: { params: { postId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, isSuspended: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.isSuspended) {
    return NextResponse.json({ error: "Your account is suspended from commenting" }, { status: 403 });
  }

  const body = await readJson(req);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  let post: { id: string; authorId: string; isSubscriberOnly: boolean } | null;
  try {
    post = await prisma.post.findFirst({
      where: { id: params.postId, isArchived: false },
      select: { id: true, authorId: true, isSubscriberOnly: true },
    });
  } catch (error) {
    if (!isMissingPostArchiveError(error)) throw error;
    post = await prisma.post.findUnique({
      where: { id: params.postId },
      select: { id: true, authorId: true, isSubscriberOnly: true },
    });
  }
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (
    post.isSubscriberOnly &&
    post.authorId !== profile.id &&
    !(await isActiveSubscriber(profile.id, post.authorId))
  ) {
    return NextResponse.json({ error: "Subscribe to comment on this post" }, { status: 403 });
  }

  if (parsed.data.parentId) {
    const parent = await prisma.postComment.findUnique({
      where: { id: parsed.data.parentId },
      select: { postId: true },
    });
    if (!parent || parent.postId !== params.postId) {
      return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
    }
  }

  const comment = await prisma.postComment.create({
    data: {
      postId: params.postId,
      authorId: profile.id,
      parentId: parsed.data.parentId,
      content: parsed.data.content,
    },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  await flagContentIfNeeded({
    contentType: "post_comment",
    contentId: comment.id,
    contentOwnerId: profile.id,
    content: comment.content,
  });

  const count = await prisma.postComment.count({ where: { postId: params.postId } });
  return NextResponse.json({ comment: serializeComment(comment), count }, { status: 201 });
}
