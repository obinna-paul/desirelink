import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function AccountReinstatedEmail() {
  return (
    <EmailLayout preview="Your Udala account is active again.">
      <Text style={eyebrow}>Account status</Text>
      <Text style={heading}>Your account is active again</Text>
      <Text style={paragraph}>
        Good news — your account has been fully restored. Everything works exactly as it did before.
      </Text>
      <EmailButton href={absoluteUrl("/")}>Back to Udala</EmailButton>
    </EmailLayout>
  );
}
