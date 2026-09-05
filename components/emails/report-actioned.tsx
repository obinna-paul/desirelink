import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function ReportActionedEmail() {
  return (
    <EmailLayout preview="An update on the report you submitted">
      <Text style={eyebrow}>Safety</Text>
      <Text style={heading}>An update on your report</Text>
      <Text style={paragraph}>
        We looked into what you reported and took action in line with our community guidelines. Thanks for helping
        keep Udala safe.
      </Text>
    </EmailLayout>
  );
}
