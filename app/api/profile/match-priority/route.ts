import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { MATCH_PRIORITY_VALUES } from "@/lib/match-priority";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/security/request";

const matchPrioritySchema = z.object({
  priority: z.enum(MATCH_PRIORITY_VALUES),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = matchPrioritySchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid match priority." }, { status: 400 });
  }

  const profile = await prisma.profile.update({
    where: { userId: session.user.id },
    data: { matchPriority: parsed.data.priority },
    select: { matchPriority: true },
  });

  return NextResponse.json({ matchPriority: profile.matchPriority }, { status: 200 });
}
