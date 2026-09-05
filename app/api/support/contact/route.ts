import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitSupportTicket } from "@/lib/support";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { getClientIp, readJson } from "@/lib/security/request";

const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  subject: z.string().trim().min(1, "Add a subject"),
  message: z.string().trim().min(1, "Add a message"),
});

export async function POST(req: Request) {
  const body = await readJson(req);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const limit = checkRateLimit(`support-contact:${ip}:${parsed.data.email}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const session = await getServerSession(authOptions);
  let profileId: string | null = null;
  if (session?.user?.id) {
    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    profileId = profile?.id ?? null;
  }

  const result = await submitSupportTicket(parsed.data.email, parsed.data.subject, parsed.data.message, profileId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, ticketId: result.ticketId }, { status: 201 });
}
