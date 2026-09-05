import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function SubscriptionCancelledEmail({ creatorName, endsAt }: { creatorName: string; endsAt: string }) {
  return (
    <EmailLayout preview={`You've cancelled your ${creatorName} subscription`}>
      <Text style={eyebrow}>Subscription</Text>
      <Text style={heading}>You&apos;ve cancelled</Text>
      <Text style={paragraph}>
        Done — you won&apos;t be charged again for {creatorName}. You keep full access through{" "}
        <strong>{endsAt}</strong>, since that month&apos;s already paid for.
      </Text>
      <Text style={paragraph}>
        Changed your mind? You can undo this any time before then from your subscriptions settings.
      </Text>
    </EmailLayout>
  );
}
