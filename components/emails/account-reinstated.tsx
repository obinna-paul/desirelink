import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function AccountReinstatedEmail() {
  return (
    <EmailLayout preview="You're back">
      <Text style={eyebrow}>Account status</Text>
      <Text style={heading}>You&apos;re back</Text>
      <Text style={paragraph}>
        Your account&apos;s fully restored. Everything works like it did before.
      </Text>
      <EmailButton href={absoluteUrl("/")}>Back to Udala</EmailButton>
    </EmailLayout>
  );
}
