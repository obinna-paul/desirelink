import { Link, Text } from "@react-email/components";

import { Callout, EmailLayout, colors, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function PasswordChangedEmail({ device, timestamp }: { device: string; timestamp: string }) {
  return (
    <EmailLayout preview={`Changed on ${timestamp} from ${device} — wasn't you? Email us right away`}>
      <Text style={eyebrow}>Security</Text>
      <Text style={heading}>Password changed</Text>
      <Text style={paragraph}>
        Changed on <strong>{timestamp}</strong> from <strong>{device}</strong>.
      </Text>
      <Text style={paragraph}>Just a record for you — nothing to do here.</Text>
      <Callout>
        Wasn&apos;t you?{" "}
        <Link href="mailto:help@udala.pro" style={{ color: colors.accent, fontWeight: 600 }}>
          Email help@udala.pro
        </Link>{" "}
        right away and we&apos;ll lock the account down.
      </Callout>
    </EmailLayout>
  );
}
