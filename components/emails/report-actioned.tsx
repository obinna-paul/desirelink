import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function ReportActionedEmail() {
  return (
    <EmailLayout preview="We took action under our community guidelines">
      <Text style={eyebrow}>Safety</Text>
      <Text style={heading}>An update on your report</Text>
      <Text style={paragraph}>
        We reviewed what you reported and took action under our community guidelines. Thanks for flagging it.
      </Text>
    </EmailLayout>
  );
}
