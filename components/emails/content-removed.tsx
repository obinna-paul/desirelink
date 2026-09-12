import { Link, Text } from "@react-email/components";

import { EmailLayout, colors, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function ContentRemovedEmail({ contentLabel }: { contentLabel: string }) {
  return (
    <EmailLayout preview="It went against our community guidelines">
      <Text style={eyebrow}>Safety</Text>
      <Text style={heading}>A {contentLabel} was removed</Text>
      <Text style={paragraph}>
        Something you posted was removed for going against our community guidelines.
      </Text>
      <Text style={paragraph}>
        Think we got it wrong? Reply to{" "}
        <Link href="mailto:help@udala.pro" style={{ color: colors.accent, fontWeight: 600 }}>
          help@udala.pro
        </Link>
        .
      </Text>
      <Text style={muted}>— Udala</Text>
    </EmailLayout>
  );
}
