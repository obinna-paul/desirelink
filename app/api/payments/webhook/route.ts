import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleWebhook } from "@/lib/payments";

const eventSchema = z.object({
  type: z.enum(["checkout.completed", "checkout.failed"]),
  transactionId: z.string(),
});

/**
 * A real payment provider would call this out-of-band and authenticate via a
 * signing secret. Our mock provider has no external caller — the "Simulate
 * Payment Success" button on the checkout page triggers it directly — so we
 * authenticate via the signed-in user's own session instead, and only allow
 * them to resolve a transaction they themselves own.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: parsed.data.transactionId },
    select: { userId: true },
  });
  if (!transaction || transaction.userId !== profile.id) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const result = await handleWebhook(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
