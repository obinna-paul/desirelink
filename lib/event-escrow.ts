import "server-only";

import { prisma } from "@/lib/prisma";
import { creditProviderWallet } from "@/lib/wallet";

export type EventEscrowResult = { ok: true } | { ok: false; status: number; error: string };

/** How long after an event ends its attendees' held ticket payments auto-release to the host (see app/api/cron/release-escrow/route.ts). */
export const EVENT_ESCROW_GRACE_HOURS = 48;

/**
 * Lets a paid "going" attendee confirm the event actually happened for
 * them, releasing their held ticket payment to the host's wallet right away
 * instead of waiting on the auto-release safety net (see
 * app/api/cron/release-escrow/route.ts). Each attendee's payment is held and
 * released independently — there's no single "close out the event" action.
 */
export async function confirmEventAttendance(eventId: string, profileId: string): Promise<EventEscrowResult> {
  const transaction = await prisma.transaction.findFirst({
    where: { eventId, userId: profileId, status: "succeeded", escrowStatus: "held" },
  });
  if (!transaction) {
    return { ok: false, status: 404, error: "No held payment found for this event." };
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { hostId: true, startTime: true },
  });
  if (!event) {
    return { ok: false, status: 404, error: "Event not found." };
  }
  if (event.startTime.getTime() > Date.now()) {
    return { ok: false, status: 400, error: "You can confirm attendance once the event has started." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transaction.id },
      data: { escrowStatus: "released", escrowReleasedAt: new Date() },
    });
    await creditProviderWallet(event.hostId, transaction.amountCents, tx);
  });

  return { ok: true };
}
