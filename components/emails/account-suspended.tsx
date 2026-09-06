import { Link, Text } from "@react-email/components";

import { EmailLayout, colors, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function AccountSuspendedEmail() {
  return (
    <EmailLayout preview="Your account is suspended">
      <Text style={eyebrow}>Account status</Text>
      <Text style={heading}>Your account is suspended</Text>
      <Text style={paragraph}>
        We suspended your account while we look into a report against it.
      </Text>
      <Text style={paragraph}>
        Think this is wrong? Reply to{" "}
        <Link href="mailto:help@udala.pro" style={{ color: colors.accent, fontWeight: 600 }}>
          help@udala.pro
        </Link>{" "}
        and we&apos;ll take another look.
      </Text>
      <Text style={muted}>— Udala</Text>
    </EmailLayout>
  );
}
