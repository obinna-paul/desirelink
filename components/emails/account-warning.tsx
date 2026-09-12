import { Link, Text } from "@react-email/components";

import { EmailLayout, colors, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function AccountWarningEmail() {
  return (
    <EmailLayout preview="Another violation risks suspension">
      <Text style={eyebrow}>Safety</Text>
      <Text style={heading}>A warning about your account</Text>
      <Text style={paragraph}>
        Recent activity broke our community guidelines. This is a warning — another one risks suspension.
      </Text>
      <Text style={paragraph}>
        Questions:{" "}
        <Link href="mailto:help@udala.pro" style={{ color: colors.accent, fontWeight: 600 }}>
          help@udala.pro
        </Link>
      </Text>
      <Text style={muted}>— Udala</Text>
    </EmailLayout>
  );
}
