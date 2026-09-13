import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

/**
 * Sent instead of a reset code when someone requests a password reset for an account
 * that has no password at all - it was created via Google/X sign-in. Sending this (rather
 * than silently doing nothing) is what makes "I tried forgot password and got no code"
 * diagnosable/fixable for the account owner, without leaking anything to a stranger: only
 * whoever controls this inbox ever sees it, same privacy property as the real OTP email.
 */
export function OAuthPasswordResetAttemptEmail({ providerLabel }: { providerLabel: string }) {
  return (
    <EmailLayout preview={`This account signs in with ${providerLabel} - there's no password to reset`}>
      <Text style={eyebrow}>Password reset requested</Text>
      <Text style={heading}>You don&apos;t have a password to reset</Text>
      <Text style={paragraph}>
        Someone (hopefully you) asked to reset the password for this Udala account, but it was created with{" "}
        {providerLabel} sign-in and has no password set.
      </Text>
      <Text style={paragraph}>Just continue with {providerLabel} to log in instead - no code needed.</Text>
      <EmailButton href={absoluteUrl("/login")}>Go to login</EmailButton>
      <Text style={{ ...muted, marginTop: 20 }}>
        Wasn&apos;t you? No action needed - your account is safe, nothing was changed.
      </Text>
    </EmailLayout>
  );
}
