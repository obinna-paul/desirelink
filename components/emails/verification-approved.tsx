import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function VerificationApprovedEmail({ username }: { username: string }) {
  return (
    <EmailLayout preview="You're verified on Udala">
      <Text style={eyebrow}>Verification</Text>
      <Text style={heading}>You&apos;re verified on Udala</Text>
      <Text style={paragraph}>
        Your verification badge is live. It does two things right away: people trust the account more, and your
        free posts can now pitch your tiers directly in the main feed — not just on your profile.
      </Text>
      <EmailButton href={absoluteUrl(`/profile/${username}`)}>See your profile</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— The Udala Team</Text>
    </EmailLayout>
  );
}
