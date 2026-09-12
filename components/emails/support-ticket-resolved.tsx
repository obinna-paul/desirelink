import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function SupportTicketResolvedEmail({ subject }: { subject: string }) {
  return (
    <EmailLayout preview="Reply here if it comes back — same thread, same person">
      <Text style={eyebrow}>Support</Text>
      <Text style={heading}>Marked resolved</Text>
      <Text style={paragraph}>
        Your ticket about &ldquo;{subject}&rdquo; is closed. If it comes back, reply here — same thread, same person.
      </Text>
    </EmailLayout>
  );
}
