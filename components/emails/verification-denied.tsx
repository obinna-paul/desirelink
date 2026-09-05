import { Link, Text } from "@react-email/components";

import { EmailLayout, colors, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function VerificationDeniedEmail({ reason }: { reason: string }) {
  return (
    <EmailLayout preview="About your Udala verification request">
      <Text style={eyebrow}>Verification</Text>
      <Text style={heading}>About your verification request</Text>
      <Text style={paragraph}>
        We looked at your verification request and can&apos;t approve it: <strong>{reason}</strong>
      </Text>
      <Text style={paragraph}>
        Since this involves a government ID, your account has also been suspended while this is unresolved —
        that&apos;s standard for a denied verification, not a separate decision. Reply to{" "}
        <Link href="mailto:help@udala.pro" style={{ color: colors.accent, fontWeight: 600 }}>
          help@udala.pro
        </Link>{" "}
        and our team will help you get sorted and resubmit.
      </Text>
      <Text style={muted}>— The Udala Team</Text>
    </EmailLayout>
  );
}
