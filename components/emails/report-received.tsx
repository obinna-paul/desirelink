import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function ReportReceivedEmail() {
  return (
    <EmailLayout preview="Report received">
      <Text style={eyebrow}>Safety</Text>
      <Text style={heading}>Report received</Text>
      <Text style={paragraph}>
        Someone on our safety team is looking at this. We&apos;ll follow up once it&apos;s reviewed.
      </Text>
    </EmailLayout>
  );
}
