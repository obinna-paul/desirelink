import "server-only";

import { prisma } from "@/lib/prisma";
import { recordAdminAction } from "@/lib/admin/audit";
import { sendSupportTicketReceivedEmail, sendSupportTicketResolvedEmail } from "@/lib/email/support-notifications";

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 4000;

export type SubmitSupportTicketResult =
  | { ok: true; ticketId: string }
  | { ok: false; status: number; error: string };

export async function submitSupportTicket(
  email: string,
  subject: string,
  message: string,
  profileId: string | null,
): Promise<SubmitSupportTicketResult> {
  const trimmedSubject = subject.trim().slice(0, MAX_SUBJECT_LENGTH);
  const trimmedMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);

  if (!trimmedSubject) return { ok: false, status: 400, error: "Add a subject" };
  if (!trimmedMessage) return { ok: false, status: 400, error: "Add a message" };

  const ticket = await prisma.supportTicket.create({
    data: { email, subject: trimmedSubject, message: trimmedMessage, profileId, status: "open" },
  });

  await sendSupportTicketReceivedEmail(email, ticket.id);

  return { ok: true, ticketId: ticket.id };
}

export async function getOpenSupportTickets() {
  return prisma.supportTicket.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "asc" },
  });
}

export type ResolveSupportTicketResult = { ok: true } | { ok: false; status: number; error: string };

export async function resolveSupportTicket(ticketId: string, actorId: string): Promise<ResolveSupportTicketResult> {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false, status: 404, error: "Ticket not found" };
  if (ticket.status !== "open") return { ok: false, status: 400, error: "This ticket is already resolved" };

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "resolved", resolvedAt: new Date(), resolvedById: actorId },
  });

  await recordAdminAction({
    actorId,
    action: "support.resolve",
    targetType: "support_ticket",
    targetId: ticketId,
    summary: `Resolved support ticket: ${ticket.subject}`,
  });

  await sendSupportTicketResolvedEmail(ticket.email, ticket.subject);

  return { ok: true };
}
