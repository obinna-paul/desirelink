import { Link, Text } from "@react-email/components";

import { Callout, EmailLayout, colors, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function PasswordChangedEmail({ device, timestamp }: { device: string; timestamp: string }) {
  return (
    <EmailLayout preview="Your Udala password was just changed.">
      <Text style={eyebrow}>Security</Text>
      <Text style={heading}>Your password was changed</Text>
      <Text style={paragraph}>
        Your password was changed on <strong>{timestamp}</strong> from <strong>{device}</strong>.
      </Text>
      <Text style={paragraph}>Nothing else to do — this is just a record for your own security.</Text>
      <Callout>
        Wasn&apos;t you?{" "}
        <Link href="mailto:help@udala.pro" style={{ color: colors.accent, fontWeight: 600 }}>
          Contact help@udala.pro
        </Link>{" "}
        right away and we&apos;ll lock the account down.
      </Callout>
    </EmailLayout>
  );
}
