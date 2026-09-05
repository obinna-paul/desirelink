import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function SupportTicketReceivedEmail({ ticketId }: { ticketId: string }) {
  return (
    <EmailLayout preview="We've got your message">
      <Text style={eyebrow}>Support</Text>
      <Text style={heading}>We&apos;ve got your message</Text>
      <Text style={paragraph}>
        Thanks for reaching out. A real person on our team will reply within 24 hours — usually much sooner.
      </Text>
      <Text style={muted}>Reference {ticketId}</Text>
    </EmailLayout>
  );
}
