import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function SupportTicketResolvedEmail({ subject }: { subject: string }) {
  return (
    <EmailLayout preview={`Re: ${subject} — resolved`}>
      <Text style={eyebrow}>Support</Text>
      <Text style={heading}>Marked resolved</Text>
      <Text style={paragraph}>
        Closing this one out. If it comes back, reply here — same thread, same person.
      </Text>
    </EmailLayout>
  );
}
