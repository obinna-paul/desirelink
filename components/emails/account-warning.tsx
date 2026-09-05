import { Link, Text } from "@react-email/components";

import { EmailLayout, colors, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function AccountWarningEmail() {
  return (
    <EmailLayout preview="A warning about your Udala account">
      <Text style={eyebrow}>Safety</Text>
      <Text style={heading}>A warning about your account</Text>
      <Text style={paragraph}>
        Recent activity on your account went against our community guidelines. This time it&apos;s a warning —
        another one puts your account at risk of suspension.
      </Text>
      <Text style={paragraph}>
        Questions:{" "}
        <Link href="mailto:help@udala.pro" style={{ color: colors.accent, fontWeight: 600 }}>
          help@udala.pro
        </Link>
      </Text>
      <Text style={muted}>— The Udala Team</Text>
    </EmailLayout>
  );
}
