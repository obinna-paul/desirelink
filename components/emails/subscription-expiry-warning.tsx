import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function SubscriptionExpiryWarningEmail({
  creatorName,
  creatorUsername,
  tierName,
  endsAt,
}: {
  creatorName: string;
  creatorUsername: string;
  tierName: string;
  endsAt: string;
}) {
  return (
    <EmailLayout preview={`Your ${creatorName} sub ends in 3 days`}>
      <Text style={eyebrow}>Subscription</Text>
      <Text style={heading}>Ends in 3 days</Text>
      <Text style={paragraph}>
        <strong>{tierName}</strong> with {creatorName} ends <strong>{endsAt}</strong>. Doesn&apos;t renew on its own.
      </Text>
      <EmailButton href={absoluteUrl(`/profile/${creatorUsername}`)}>Resubscribe</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— Udala</Text>
    </EmailLayout>
  );
}
