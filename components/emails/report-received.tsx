import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function ReportReceivedEmail() {
  return (
    <EmailLayout preview="We've received your report">
      <Text style={eyebrow}>Safety</Text>
      <Text style={heading}>We&apos;ve received your report</Text>
      <Text style={paragraph}>
        Thanks for flagging this. A real person on our safety team reviews every report — we take it from here.
      </Text>
    </EmailLayout>
  );
}
