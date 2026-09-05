import "server-only";

import { sendEmail } from "@/lib/email/send";
import { SupportTicketReceivedEmail } from "@/components/emails/support-ticket-received";
import { SupportTicketResolvedEmail } from "@/components/emails/support-ticket-resolved";

export async function sendSupportTicketReceivedEmail(email: string, ticketId: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: `We've got your message — ${ticketId}`,
    react: SupportTicketReceivedEmail({ ticketId }),
    category: "support",
    template: "support-ticket-received",
    from: "help",
  });
}

export async function sendSupportTicketResolvedEmail(email: string, subject: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Re: ${subject} — resolved`,
    react: SupportTicketResolvedEmail({ subject }),
    category: "support",
    template: "support-ticket-resolved",
    from: "help",
  });
}
