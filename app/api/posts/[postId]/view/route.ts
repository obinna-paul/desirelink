import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordPostView } from "@/lib/premium";

export async function POST(
  _req: Request,
  { params }: { params: { postId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    select: { authorId: true },
  });
  if (!post)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });

  await recordPostView(params.postId, post.authorId, profile.id);

  return NextResponse.json({ success: true }, { status: 200 });
}
