import { Link, Text } from "@react-email/components";

import { EmailLayout, colors, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function AccountSuspendedEmail() {
  return (
    <EmailLayout preview="Your Udala account has been suspended.">
      <Text style={eyebrow}>Account status</Text>
      <Text style={heading}>Your account has been suspended</Text>
      <Text style={paragraph}>
        After reviewing recent activity on your account, we&apos;ve suspended it while we look into a report.
      </Text>
      <Text style={paragraph}>
        If you think this is a mistake, reply to{" "}
        <Link href="mailto:help@udala.pro" style={{ color: colors.accent, fontWeight: 600 }}>
          help@udala.pro
        </Link>{" "}
        and our team will take a second look.
      </Text>
      <Text style={muted}>— The Udala Team</Text>
    </EmailLayout>
  );
}
