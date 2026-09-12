import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function SupportTicketReceivedEmail({ ticketId }: { ticketId: string }) {
  return (
    <EmailLayout preview="Expect a reply within 24 hours, usually sooner">
      <Text style={eyebrow}>Support</Text>
      <Text style={heading}>Got your message</Text>
      <Text style={paragraph}>Someone will reply within 24 hours, usually sooner.</Text>
      <Text style={muted}>Reference {ticketId}</Text>
    </EmailLayout>
  );
}
