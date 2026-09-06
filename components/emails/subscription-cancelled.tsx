import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";

export function SubscriptionCancelledEmail({ creatorName, endsAt }: { creatorName: string; endsAt: string }) {
  return (
    <EmailLayout preview={`You've cancelled your ${creatorName} subscription`}>
      <Text style={eyebrow}>Subscription</Text>
      <Text style={heading}>Cancelled</Text>
      <Text style={paragraph}>
        Done, you won&apos;t be charged again. Access stays through <strong>{endsAt}</strong> — that month&apos;s paid for.
      </Text>
      <Text style={paragraph}>
        Change your mind before then and you can undo it in settings.
      </Text>
    </EmailLayout>
  );
}
