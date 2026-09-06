import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function VerificationApprovedEmail({ username }: { username: string }) {
  return (
    <EmailLayout preview="You're verified">
      <Text style={eyebrow}>Verification</Text>
      <Text style={heading}>You&apos;re verified</Text>
      <Text style={paragraph}>
        Badge&apos;s live. Your free posts can now pitch your tiers right in the main feed, not just on your profile.
      </Text>
      <EmailButton href={absoluteUrl(`/profile/${username}`)}>See your profile</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— Udala</Text>
    </EmailLayout>
  );
}
