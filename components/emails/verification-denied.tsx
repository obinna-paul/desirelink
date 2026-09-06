import { Link, Text } from "@react-email/components";

import { EmailLayout, colors, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function VerificationDeniedEmail({ reason }: { reason: string }) {
  return (
    <EmailLayout preview="We couldn't approve this one">
      <Text style={eyebrow}>Verification</Text>
      <Text style={heading}>About your verification</Text>
      <Text style={paragraph}>
        We couldn&apos;t verify you: <strong>{reason}</strong>
      </Text>
      <Text style={paragraph}>
        Since this involves a government ID, we&apos;ve also paused your account until it&apos;s sorted — that&apos;s
        automatic, not a separate strike against you. Reply to{" "}
        <Link href="mailto:help@udala.pro" style={{ color: colors.accent, fontWeight: 600 }}>
          help@udala.pro
        </Link>{" "}
        and we&apos;ll help you resubmit.
      </Text>
      <Text style={muted}>— Udala</Text>
    </EmailLayout>
  );
}
