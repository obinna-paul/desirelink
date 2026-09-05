import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function SupportTicketResolvedEmail({ subject }: { subject: string }) {
  return (
    <EmailLayout preview={`Re: ${subject} — resolved`}>
      <Text style={eyebrow}>Support</Text>
      <Text style={heading}>Marked as resolved</Text>
      <Text style={paragraph}>
        Marking this one resolved. If it comes up again, just reply here — same thread, same person.
      </Text>
    </EmailLayout>
  );
}
