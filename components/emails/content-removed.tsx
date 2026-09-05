import { Link, Text } from "@react-email/components";

import { EmailLayout, colors, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function ContentRemovedEmail({ contentLabel }: { contentLabel: string }) {
  return (
    <EmailLayout preview={`A ${contentLabel} of yours was removed`}>
      <Text style={eyebrow}>Safety</Text>
      <Text style={heading}>A {contentLabel} of yours was removed</Text>
      <Text style={paragraph}>
        Something you shared on Udala was removed for going against our community guidelines.
      </Text>
      <Text style={paragraph}>
        Think this was a mistake? Reply to{" "}
        <Link href="mailto:help@udala.pro" style={{ color: colors.accent, fontWeight: 600 }}>
          help@udala.pro
        </Link>
        .
      </Text>
      <Text style={muted}>— The Udala Team</Text>
    </EmailLayout>
  );
}
